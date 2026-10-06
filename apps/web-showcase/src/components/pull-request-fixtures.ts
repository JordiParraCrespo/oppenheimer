/** What the Pull requests demos share: one pull request's files, as git hands them over. */

export const KEYCHAIN_PATCH = `diff --git a/runner/internal/keychain/keychain.go b/runner/internal/keychain/keychain.go
--- a/runner/internal/keychain/keychain.go
+++ b/runner/internal/keychain/keychain.go
@@ -72,13 +72,26 @@ func (k *Keychain) Migrate(ctx context.Context) error {
 	path := filepath.Join(k.dir, "tokens.json")
 	raw, err := os.ReadFile(path)
 	if errors.Is(err, fs.ErrNotExist) {
 		return nil
 	}
 	if err != nil {
-		return err
+		return fmt.Errorf("read token file: %w", err)
 	}
-	var tokens map[string]string
-	json.Unmarshal(raw, &tokens)
+	var tokens map[string]Token
+	if err := json.Unmarshal(raw, &tokens); err != nil {
+		return fmt.Errorf("parse token file: %w", err)
+	}
+	if k.epoch.Load() != k.startEpoch {
+		return ErrStaleEpoch
+	}
+	if err := os.Remove(path); err != nil {
+		return err
+	}
+	for id, t := range tokens {
+		if err := k.store.Set(id, t.Secret); err != nil {
+			return fmt.Errorf("store %s: %w", id, err)
+		}
+	}
 	k.log.Info("migrated tokens", "count", len(tokens))
 	return nil
 }
@@ -131,3 +146,8 @@ func (k *Keychain) Get(id string) (string, error) {
 	k.mu.RLock()
 	defer k.mu.RUnlock()
+	secret, err := k.store.Get(id)
+	if errors.Is(err, ErrNotFound) {
+		return k.legacy.Get(id)
+	}
+	return secret, err
 }
`;

export const RECONNECT_PATCH = `diff --git a/web/src/session/reconnect.ts b/web/src/session/reconnect.ts
--- a/web/src/session/reconnect.ts
+++ b/web/src/session/reconnect.ts
@@ -18,7 +18,9 @@ export async function reconnect(session: Session): Promise<Link> {
   const version = await session.runner.version();
-  const token = await readTokenFile(session.runner);
+  const token = semver.gte(version, '0.9.0')
+    ? await session.runner.keychain.get(session.id)
+    : await readTokenFile(session.runner);
   if (!token) {
     throw new SessionError('RUNNER_TOKEN_MISSING');
   }
   return openLink(session, token);
 }
`;

export const PR_FILES = [
  { path: 'runner/internal/keychain/keychain.go', additions: 318, deletions: 40 },
  { path: 'runner/internal/keychain/keychain_test.go', additions: 236, deletions: 0 },
  { path: 'runner/internal/tokens/tokens.go', additions: 0, deletions: 96 },
  { path: 'web/src/session/reconnect.ts', additions: 58, deletions: 112 },
] as const;
