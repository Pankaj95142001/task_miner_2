# Remote Windows recorder

This package runs inside the remote Windows session, next to the applications being recorded. Running it on the local PC still only inspects the RDP client window.

1. Copy and extract this ZIP on the remote machine. Python 3.11+ with Tkinter must be installed there.
2. Run setup-remote-recorder.cmd once to install the small recorder dependencies.
3. Run start-remote-recorder.cmd. Enter the dashboard backend address, its session token, and a workflow name. No OpenAI API key is needed on the remote machine.
4. Click Start recording. After 3 seconds, perform your task in the remote session. Use the floating Pause and Stop controls there.
5. Refresh the workflow library on the dashboard PC. Review the new workflow and its Captured details (machine, Automation ID, control name/type), then use Vision assistance and export the SOP.

## Connecting to the dashboard

The current backend listens on 127.0.0.1:8000 on the dashboard PC. That address on the remote machine refers to the remote machine itself. Use an organization-approved HTTPS endpoint or an SSH tunnel to reach the dashboard PC. The agent accepts HTTP only on localhost and verifies HTTPS certificates using the Windows/system trust store. It never disables TLS verification or sends your token to redirects.

If an approved SSH server is available on the dashboard PC, run this command INSIDE the remote session and keep it running (replace the username and hostname):

    ssh -N -L 18000:127.0.0.1:8000 username@dashboard-pc

Then enter http://127.0.0.1:18000 in the agent. Do not expose the dashboard's HTTP port publicly. No backend network binding or firewall changes are made by this package. A reverse proxy must allow screenshot uploads (up to approximately 16 MB per step).

## Recovery and limitations

Unsent steps and screenshots are stored in %LOCALAPPDATA%\SOPStudioRemoteRecorder\recording. If the network drops, recording retries upload and pauses when the pending queue fills. Run the agent again with the same backend and choose Recover saved steps. Do not delete that directory until recovery completes. The token is kept only in memory; enter it again on the next launch.

Keep the remote session open, visible and unlocked. Control capture depends on each application's Windows accessibility support; some custom-drawn controls still provide no IDs. Desktop capture does not produce CSS selectors; use a browser recorder inside the remote machine for DOM selectors. Password/protected or unreadable fields remain private/manual.

This release records and uploads remote desktop steps. Review, improve and export the SOP from the connected dashboard. Existing recordings made outside RDP cannot retroactively acquire real controls; record again inside the session.
