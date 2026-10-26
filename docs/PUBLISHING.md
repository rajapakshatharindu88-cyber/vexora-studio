# Publishing VEXORA to a remote Git repository

This source bundle is intended to become an independently maintained repository. No remote publication is implied by this file.

1. Create a **new empty repository** on your Git hosting account, such as `vexora-studio`. Do not select a template or import an existing application repository history.
2. Extract `VEXORA-Source.zip` and open a terminal inside the `vexora-studio` directory.
3. Initialize a clean Git history if one is not already present:

   ```bash
   git init -b main
   git add .
   git commit -m "Initial VEXORA Studio source"
   ```

4. Add the repository URL provided by your Git hosting service, then push:

   ```bash
   git remote add origin YOUR_EMPTY_REPOSITORY_URL
   git push -u origin main
   ```

5. Run `npm test` and `npm run check` before publishing. Do not put access tokens or private keys in the source repository.
6. To publish a release, upload the tested source ZIP and only those platform binaries that were actually built and tested. Record the precise version and known limitations.

If the ZIP contains an existing `.git` directory from the packager, inspect `git log --oneline` first. For a brand-new public repository, it is acceptable to remove the local `.git` metadata and initialize a new clean history before pushing. This does not remove source files.
