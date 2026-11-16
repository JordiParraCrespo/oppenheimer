// Oppenheimer desktop, Tauri spike: the twin of `../../desktop-spike` (Electron).
// The hosted console in a window, plus one bridge to the runner on this machine
// (its 0600 Unix socket), so a session whose host is this machine is attached
// with no network in between. The console sees the same `window.oppenheimerDesktop`
// in both shells (`../bridge.js` here, `preload.cjs` there).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{
        atomic::{AtomicU32, AtomicUsize, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};

use futures_util::{FutureExt, SinkExt, StreamExt};
use tauri::{
    ipc::{Channel, InvokeResponseBody},
    webview::PageLoadEvent,
    Manager, State, Url, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_opener::OpenerExt;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::UnixStream,
    sync::{mpsc, Notify},
};
use tokio_tungstenite::tungstenite::{client::IntoClientRequest, Message};

// The credit window, as on the relay (01, "Flow control"): past HIGH bytes the
// page has not drained, stop reading the socket, which stalls the runner's
// write and its PTY read and leaves the backlog in tmux; read again below LOW.
const HIGH: usize = 1024 * 1024;
const LOW: usize = 256 * 1024;
const COALESCE: usize = 256 * 1024;

fn socket_path() -> PathBuf {
    let home = std::env::var_os("RUNNER_HOME")
        .filter(|v| !v.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            PathBuf::from(std::env::var_os("HOME").unwrap_or_default()).join(".oppenheimer")
        });
    home.join("run").join("runner.sock")
}

fn encode(id: &str) -> String {
    url::form_urlencoded::byte_serialize(id.as_bytes()).collect()
}

/// `GET` on the runner's socket, HTTP/1.0 so the body ends at EOF.
async fn runner_get(route: &str) -> Result<serde_json::Value, String> {
    let io = async {
        let mut s = UnixStream::connect(socket_path())
            .await
            .map_err(|e| e.to_string())?;
        s.write_all(format!("GET {route} HTTP/1.0\r\nHost: runner\r\n\r\n").as_bytes())
            .await
            .map_err(|e| e.to_string())?;
        let mut buf = Vec::new();
        s.read_to_end(&mut buf).await.map_err(|e| e.to_string())?;
        Ok::<_, String>(buf)
    };
    let buf = tokio::time::timeout(Duration::from_secs(2), io)
        .await
        .map_err(|_| "timeout")??;
    let text = String::from_utf8_lossy(&buf);
    let (head, body) = text.split_once("\r\n\r\n").ok_or("bad response")?;
    if !head.starts_with("HTTP/1.1 200") && !head.starts_with("HTTP/1.0 200") {
        return Err(head.lines().next().unwrap_or_default().to_string());
    }
    serde_json::from_str(body).map_err(|e| e.to_string())
}

enum Out {
    Bytes(Vec<u8>),
    Text(String),
    Close,
}

struct Attachment {
    owner: String,
    out: mpsc::UnboundedSender<Out>,
    inflight: Arc<AtomicUsize>,
    drained: Arc<Notify>,
}

#[derive(Default)]
struct Attachments {
    next: AtomicU32,
    map: Mutex<HashMap<u32, Attachment>>,
}

impl Attachments {
    fn close_owned_by(&self, owner: &str) {
        for a in self.map.lock().unwrap().values() {
            if a.owner == owner {
                let _ = a.out.send(Out::Close);
            }
        }
    }
    /// An attachment belongs to the page that opened it, and only that page may drive it.
    fn send(&self, webview: &tauri::Webview, handle: u32, msg: Out) {
        if let Some(a) = self.map.lock().unwrap().get(&handle) {
            if a.owner == webview.label() {
                let _ = a.out.send(msg);
            }
        }
    }
}

#[tauri::command]
async fn local_has_session(id: String) -> bool {
    match runner_get(&format!("/v1/sessions/{}", encode(&id))).await {
        Ok(s) => s.get("id").and_then(|v| v.as_str()) == Some(id.as_str()),
        Err(_) => false,
    }
}

#[tauri::command]
async fn local_attach(
    webview: tauri::Webview,
    state: State<'_, Arc<Attachments>>,
    id: String,
    window: u32,
    cols: u32,
    rows: u32,
    on_data: Channel<InvokeResponseBody>,
) -> Result<u32, String> {
    let path = format!(
        "/v1/sessions/{}/attach?window={window}&cols={cols}&rows={rows}",
        encode(&id)
    );
    let request = format!("ws://runner{path}")
        .into_client_request()
        .map_err(|e| e.to_string())?;
    // A dial that never opens or fails would leave the page waiting forever.
    let dial = async {
        let stream = UnixStream::connect(socket_path())
            .await
            .map_err(|e| e.to_string())?;
        tokio_tungstenite::client_async(request, stream)
            .await
            .map_err(|e| e.to_string())
    };
    let (ws, _) = tokio::time::timeout(Duration::from_secs(5), dial)
        .await
        .map_err(|_| "timeout")??;
    let (mut sink, mut stream) = ws.split();

    let attachments = state.inner().clone();
    let handle = attachments.next.fetch_add(1, Ordering::Relaxed) + 1;
    let (tx, mut rx) = mpsc::unbounded_channel::<Out>();
    let inflight = Arc::new(AtomicUsize::new(0));
    let drained = Arc::new(Notify::new());
    attachments.map.lock().unwrap().insert(
        handle,
        Attachment {
            owner: webview.label().to_string(),
            out: tx,
            inflight: inflight.clone(),
            drained: drained.clone(),
        },
    );

    // Page -> runner.
    tauri::async_runtime::spawn(async move {
        while let Some(msg) = rx.recv().await {
            let sent = match msg {
                Out::Bytes(b) => sink.send(Message::Binary(b.into())).await,
                Out::Text(t) => sink.send(Message::Text(t.into())).await,
                Out::Close => {
                    let _ = sink.close().await;
                    break;
                }
            };
            if sent.is_err() {
                break;
            }
        }
    });

    // Runner -> page, paused past the credit window. Dropping `on_data` at the
    // end tells the page the attachment closed. Frames already waiting are
    // sent as one message (up to COALESCE bytes): each channel message larger
    // than a few bytes costs the page one IPC fetch, which, not the bytes, is
    // what limits throughput. A lone keystroke's echo still goes at once.
    let coalesce = if std::env::var_os("OPPENHEIMER_NO_COALESCE").is_some() {
        0
    } else {
        COALESCE
    };
    tauri::async_runtime::spawn(async move {
        'read: while let Some(Ok(msg)) = stream.next().await {
            let Message::Binary(first) = msg else {
                continue;
            };
            let mut batch: Vec<u8> = first.into();
            while batch.len() < coalesce {
                match stream.next().now_or_never() {
                    Some(Some(Ok(Message::Binary(more)))) => batch.extend_from_slice(&more),
                    Some(Some(Ok(_))) => {}
                    Some(_) => {
                        let _ = on_data.send(InvokeResponseBody::Raw(batch));
                        break 'read;
                    }
                    None => break,
                }
            }
            let n = batch.len();
            if on_data.send(InvokeResponseBody::Raw(batch)).is_err() {
                break;
            }
            if inflight.fetch_add(n, Ordering::AcqRel) + n > HIGH {
                while inflight.load(Ordering::Acquire) >= LOW {
                    drained.notified().await;
                }
            }
        }
        attachments.map.lock().unwrap().remove(&handle);
    });
    Ok(handle)
}

#[tauri::command]
fn local_write(
    webview: tauri::Webview,
    state: State<'_, Arc<Attachments>>,
    handle: u32,
    data: String,
) {
    state.send(&webview, handle, Out::Bytes(data.into_bytes()));
}

#[tauri::command]
fn local_resize(
    webview: tauri::Webview,
    state: State<'_, Arc<Attachments>>,
    handle: u32,
    cols: u32,
    rows: u32,
) {
    let msg = serde_json::json!({ "type": "resize", "cols": cols, "rows": rows }).to_string();
    state.send(&webview, handle, Out::Text(msg));
}

#[tauri::command]
fn local_credit(
    webview: tauri::Webview,
    state: State<'_, Arc<Attachments>>,
    handle: u32,
    bytes: usize,
) {
    if let Some(a) = state.map.lock().unwrap().get(&handle) {
        if a.owner != webview.label() {
            return;
        }
        let before = a
            .inflight
            .fetch_update(Ordering::AcqRel, Ordering::Acquire, |v| {
                Some(v.saturating_sub(bytes))
            });
        if before
            .map(|v| v.saturating_sub(bytes) < LOW)
            .unwrap_or(false)
        {
            a.drained.notify_one();
        }
    }
}

#[tauri::command]
fn local_close(webview: tauri::Webview, state: State<'_, Arc<Attachments>>, handle: u32) {
    state.send(&webview, handle, Out::Close);
}

/// The bench's only hook: the page reports a JSON result and the shell prints
/// it for the harness (`../bench/run.mjs`), which ends the process. Granted to
/// the console only under `OPPENHEIMER_BENCH`.
#[tauri::command]
fn bench_report(result: serde_json::Value) {
    use std::io::Write;
    println!("BENCH {result}");
    let _ = std::io::stdout().flush();
}

fn main() {
    let console =
        std::env::var("OPPENHEIMER_CONSOLE_URL").unwrap_or_else(|_| "http://localhost:3000".into());
    let console: Url = console.parse().expect("OPPENHEIMER_CONSOLE_URL");
    let origin = console.origin();
    let no_bridge = std::env::var_os("OPPENHEIMER_NO_BRIDGE").is_some();
    let bench = std::env::var("OPPENHEIMER_BENCH").ok();
    let started = std::time::Instant::now();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Arc::new(Attachments::default()))
        .invoke_handler(tauri::generate_handler![
            local_has_session,
            local_attach,
            local_write,
            local_resize,
            local_credit,
            local_close,
            bench_report
        ])
        .setup(move |app| {
            // Remote content reaches no command unless a capability names its
            // URL: the console's origin, and only this window, gets the bridge.
            let mut capability = tauri::ipc::CapabilityBuilder::new("console")
                .remote(format!("{}/*", origin.ascii_serialization()))
                .window("main");
            for command in [
                "local-has-session",
                "local-attach",
                "local-write",
                "local-resize",
                "local-credit",
                "local-close",
            ] {
                capability = capability.permission(format!("allow-{command}"));
            }
            if bench.is_some() {
                capability = capability.permission("allow-bench-report");
            }
            app.add_capability(capability)?;

            let handle = app.handle().clone();
            let mut builder =
                WebviewWindowBuilder::new(app, "main", WebviewUrl::External(console.clone()))
                    .title("Oppenheimer")
                    .inner_size(1440.0, 900.0)
                    // The window is the console and nothing else; every other link
                    // opens in the system browser.
                    .on_navigation(move |url| {
                        if url.origin() == origin {
                            return true;
                        }
                        let _ = handle.opener().open_url(url.as_str(), None::<&str>);
                        false
                    })
                    .on_page_load(move |webview, payload| match payload.event() {
                        // A page that reloads or navigates takes its attachments with it.
                        PageLoadEvent::Started => {
                            webview
                                .state::<Arc<Attachments>>()
                                .close_owned_by(webview.label());
                        }
                        PageLoadEvent::Finished => {
                            println!(
                                "LOADED {} ms {}",
                                started.elapsed().as_millis(),
                                payload.url()
                            );
                            let _ = std::io::Write::flush(&mut std::io::stdout());
                        }
                    });
            if !no_bridge {
                builder = builder.initialization_script(include_str!("../../bridge.js"));
            }
            if let Some(script) = &bench {
                let js = std::fs::read_to_string(script).expect("OPPENHEIMER_BENCH script");
                builder = builder.initialization_script(&js);
            }
            builder.build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the Tauri spike");
}
