# Facebook and integration capability report

Checked 2026-11-03. Status values are `supported`, `unsupported`, `needs_setup`, or `degraded`. A draft is never labeled published. `verified` means an operator attested and the pasted URL is a post in group `604690051505802`. The app does not fetch Facebook to prove the post is live.

## Registry

| Key | Status | What was proven |
| --- | --- | --- |
| facebook_group_feed_read | unsupported | Public Groups API feed read was removed with Graph API v19.0 on 2024-04-22 (`publish_to_groups`, `groups_access_member_info`, Groups API). Direct fetch of the changelog timed out during this build; Buffer and Zapier document the same removal. |
| facebook_group_publish | unsupported | No Graph write function exists in this app. |
| facebook_group_comment | unsupported | Group comments are not posted by the app. |
| facebook_group_member_read | unsupported | Member lists are not read from Facebook. Staff exclusion is an operator list. |
| facebook_unattended_read_write | unsupported | No scraped session, vaulted password, or unofficial token. |
| human_assisted_browser_publish | supported | Supported as a human procedure. Primary path: approve a draft, a person posts in the group while logged in as Cole, then pastes the permalink. It does not run unattended. |
| permalink_verification | supported | Checks `/groups/604690051505802/posts/{id}` plus a human attestation. Share links stay unverified. |
| buffer_channel_connected | degraded | Read-only on 2026-11-03. Organization `6aea481c2f2977ad27bd75d1`, account `cole@smackinsnacks.com`, channel `6aea4900e29c69a17150b894`, name SMACKIN’ VIP, service facebook, type group, disconnected false. `externalLink` is `https://https://www.facebook.com/groups/604690051505802` (scheme duplicated). No post was created. |
| buffer_notification_schedule | needs_setup | Client can send `schedulingType: notification` to `https://api.buffer.com` after approval in bounded live mode. `BUFFER_API_KEY` is not configured for this app, so no live call is claimed. A Buffer id is not a Facebook publish. |
| buffer_automatic_group_publish | unsupported | Buffer documents that group posts are notification-only. This client rejects `automatic`. |
| google_drive_runtime_sync | needs_setup | The app process has no Google credential and does not write to Drive. |
| google_drive_setup_session_read | degraded | Setup session listed folder `1oNe5i3nNx-jm9ckuurF44ogtVctqicJ3` and doc `1eSj5KKoOdlaAAXV1HXokgmqmFtTBzptBvHIBwIG1TaI` (“VIP Featured Drafts Review 2026-11-03”). That read is not an ongoing connector. |
| grok_function_calling | needs_setup | Responses API tool loop is implemented (`https://api.x.ai/v1/responses`). No `XAI_API_KEY` was present in this environment. Approve and publish are not tools. A successful `grok_runs` row moves this to supported. |
| contribution_ingest | degraded | Manual and import rows count. Sample rows are `sample_not_live`. There is no live group ingest. |

## Sources

- https://developers.facebook.com/docs/graph-api/changelog/version19.0/
- https://support.buffer.com/article/570-connecting-facebook-groups-and-troubleshooting-connections
- https://developers.buffer.com/types/SchedulingType.html
- https://help.zapier.com/hc/en-us/articles/23970212345357-App-update-Facebook-Groups-app-removal
- https://docs.x.ai/developers/tools/function-calling
- Drive folder: https://drive.google.com/drive/folders/1oNe5i3nNx-jm9ckuurF44ogtVctqicJ3

## What Cole should correct in Buffer

The connected channel’s group URL repeats `https://`. Fix that in Buffer’s channel settings before relying on the mobile notification. Buffer remains the backup path. The primary path is still a person posting the approved draft.
