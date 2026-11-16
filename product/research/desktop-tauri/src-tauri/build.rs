// The app's own commands get an ACL manifest, so the console (a remote origin)
// can reach them only through the capability `main.rs` grants its URL.
fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "local_has_session",
            "local_attach",
            "local_write",
            "local_resize",
            "local_credit",
            "local_close",
            "bench_report",
        ]),
    ))
    .expect("tauri build");
}
