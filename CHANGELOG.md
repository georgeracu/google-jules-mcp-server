# Changelog

## [0.4.0](https://github.com/georgeracu/google-jules-mcp-server/compare/google-jules-mcp-server-v0.3.2...google-jules-mcp-server-v0.4.0) (2026-08-31)


### Features

* add jules_list_stuck_sessions tool ([ddd1cbb](https://github.com/georgeracu/google-jules-mcp-server/commit/ddd1cbbe93e6eccbb09589b1edcfc0b6c14a4a76))
* Add standalone session watcher for stuck sessions ([#45](https://github.com/georgeracu/google-jules-mcp-server/issues/45)) ([1cdbd0a](https://github.com/georgeracu/google-jules-mcp-server/commit/1cdbd0ac56cb97cce068df1ff07f5a751e56c008))
* add stuck sessions tool ([2034080](https://github.com/georgeracu/google-jules-mcp-server/commit/203408091c4a228bf00fd9082c8af636a9b85ae9))
* **release:** automate versioning and changelog with release-please ([d0dddc1](https://github.com/georgeracu/google-jules-mcp-server/commit/d0dddc183399a14e41f33c0076a0baf6402206bf))
* **release:** automate versioning and changelog with release-please ([1e53512](https://github.com/georgeracu/google-jules-mcp-server/commit/1e53512b549963cd33e83d01e5fd731224fdc12f))


### Bug Fixes

* default createSession state to QUEUED when API omits it ([d5a35ca](https://github.com/georgeracu/google-jules-mcp-server/commit/d5a35ca33e9362d0f11825a37b0130af0f07ea78))
* guard publish job's release_created condition explicitly ([f73b2ff](https://github.com/georgeracu/google-jules-mcp-server/commit/f73b2ff084b29dea2aea1faed2bf6a6d01af416c))
* make npm publish idempotent against partial release-job retries ([a332a31](https://github.com/georgeracu/google-jules-mcp-server/commit/a332a31cb4309d6070a20c93f18455cc750e8c73))
* parse and format session change-set outputs ([2fdff27](https://github.com/georgeracu/google-jules-mcp-server/commit/2fdff27c15e25c93b3aabdd0978064b770624b34))
* parse and format session change-set outputs ([d837f1b](https://github.com/georgeracu/google-jules-mcp-server/commit/d837f1b45f7293a117b1756f1c548b73c31f66df))
* parse and format session change-set outputs ([8718cb9](https://github.com/georgeracu/google-jules-mcp-server/commit/8718cb9cefa8f5ac0d33799564be66485ef003c2))
* parse and format session change-set outputs ([68c20aa](https://github.com/georgeracu/google-jules-mcp-server/commit/68c20aab41f96dfdd3d64809ea6b18ef54da1f11))
* parse and format session change-set outputs ([3d7480b](https://github.com/georgeracu/google-jules-mcp-server/commit/3d7480b114035f8a006f20a66cb052ddcb5a4d45))
* parse and format session change-set outputs ([628d7b4](https://github.com/georgeracu/google-jules-mcp-server/commit/628d7b42c9b89830bf50c88a8416ddf6d76249ae))
* parse and format session change-set outputs ([247d2e7](https://github.com/georgeracu/google-jules-mcp-server/commit/247d2e71e57320b2f0407eb55321e6cb3dff7aec))
* parse and format session change-set outputs ([6fbe281](https://github.com/georgeracu/google-jules-mcp-server/commit/6fbe28169a05b8624038a41e950e391a97f4f77e))
* parse and format session change-set outputs ([79f753f](https://github.com/georgeracu/google-jules-mcp-server/commit/79f753fe6d8fb13471636b5aa844c2efb6e819b2))
* parse and format session change-set outputs ([1d19bd7](https://github.com/georgeracu/google-jules-mcp-server/commit/1d19bd7d970112e80fa78a6b1a38ef500dbc48a7))
* parse and format session change-set outputs ([86fc180](https://github.com/georgeracu/google-jules-mcp-server/commit/86fc1803eb59e28a82f621365349a666e5ad870b))
* **release:** merge release-please and publish into one workflow ([5c03177](https://github.com/georgeracu/google-jules-mcp-server/commit/5c0317790ed1088ed9536c5e9e56036037df0ec9))
* render both PR and changeSet outputs when a session has both ([262b550](https://github.com/georgeracu/google-jules-mcp-server/commit/262b550b92100d0a50bedf99e74ea73aa26185ad))
* resolve code coverage regression from missing branch ([715268a](https://github.com/georgeracu/google-jules-mcp-server/commit/715268a56c77723bb6eb4e0b90d1dc94f5ffc3ba)), closes [#67](https://github.com/georgeracu/google-jules-mcp-server/issues/67)
