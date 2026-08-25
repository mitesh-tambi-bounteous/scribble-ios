# Getting scribl onto other people's iPhones

scribl produces three build outputs from one Expo codebase: the web export
(hosted on S3/CloudFront), the Android APK (see Android Distribution), and the
iOS build (this page). This page covers the native iOS output: how testers can
get it, and how the local build was proven.

## TL;DR / recommendation

No. There is no free "hand them any .ipa and they install it" equivalent to an
Android APK. Apple gates every install by code-signing that is tied to Apple's
own servers, so a raw file plus a willing tester is never enough. To get scribl
in front of investors and testers, use TestFlight, which needs the paid Apple
Developer Program (99 USD/yr). Use TestFlight; the exact steps are in section 4.

## Why iOS is different from Android

On Android, a user can flip on "install from unknown sources" and side-load a
raw APK with zero involvement from Google. You build the APK, you send the file,
they tap it, done. iOS has no such switch.

Every app that runs on a non-jailbroken iPhone must be signed with an
Apple-issued certificate plus a provisioning profile. That profile names either
the app (App Store / TestFlight distribution) or the specific devices allowed to
run it (ad-hoc / development). The signature is checked against Apple's servers
at install time and at launch.

The `.ipa` file is the iOS analog of the `.apk`: it is the packaged build. But
the file alone is not enough. It must be signed for the intended distribution
channel, and for most channels it must be delivered through Apple's
infrastructure. There is no "unknown sources" escape hatch. This is a platform
policy, not a limitation of your tooling.

## The real options

| Option | Cost | Who can install | Device limit | Expiry | Best for |
|--------|------|-----------------|--------------|--------|----------|
| TestFlight | 99 USD/yr | Anyone you invite by email or public link | 10,000 external + 100 internal | Builds expire after 90 days | Investor / tester demos (recommended) |
| Ad-hoc IPA | 99 USD/yr | Only devices whose UDID you registered before building | 100 iPhones per membership year | Provisioning profile up to 1 year | A small, fixed set of known devices |
| Development (free Apple ID) | Free | Only your own registered devices | A handful of your own devices | 7 days (free account) | Running scribl on your own iPhone in dev |
| Enterprise Program | 299 USD/yr | Your own employees, unregistered devices | No registration, internal only | Cert up to 1 year | Internal apps for 100+ employee orgs (NOT for scribl) |

### TestFlight (RECOMMENDED for investor / tester demos)

Needs the paid Apple Developer Program (99 USD/yr) plus App Store Connect.
Testers install the free TestFlight app from the App Store, then tap an invite
link or a public link. You get up to 10,000 external testers (invited by email
or via a shareable public link) and up to 100 internal testers (App Store
Connect users on your team) who receive builds instantly.

Builds for external testers go through a light Apple review, which is usually
fast. Every build expires after 90 days, so you re-upload to renew. This is the
closest thing to a "just tap this link" experience for a non-technical tester,
and it is the right answer for demos.

### Ad-hoc IPA (closest to "hand them a file")

Needs the paid Apple Developer account. Each tester device's UDID must be
registered in the provisioning profile BEFORE you build; the `.ipa` is signed
against those specific devices. You are capped at 100 iPhones per membership
year (the cap is per device type). You then distribute the signed `.ipa` plus
the profile yourself, for example via a website, a service like Diawi, or Apple
Configurator.

This is the nearest thing to the Android "hand them a file" model, but it is
fiddly: you must collect every tester's UDID up front, and you must rebuild
whenever you add a device. Good for a small fixed set of known devices, bad for
an open or growing tester list.

### Development / free Apple ID

Any Apple ID, with no paid program, can sign a build onto YOUR OWN devices via
Xcode. The provisioning expires after 7 days on a free account and is limited to
a handful of your own registered devices. This is fine for running scribl on
your own iPhone during development. It is NOT usable for handing builds out to
other people.

### Apple Developer Enterprise Program (do NOT use for scribl)

For 299 USD/yr, this program allows in-house distribution of signed `.ipa` files
to devices you do NOT have to register, with no App Store review. On paper this
looks like the APK dream.

It is not for you. Eligibility is strict: an organization with 100+ employees, a
D-U-N-S number, and explicit Apple approval. It is ONLY for distributing to your
own employees. Using it to ship to outside testers or investors violates the
agreement and gets your certificates revoked. It exists; do not rely on it for
scribl.

## Recommended path, step by step (TestFlight)

1. Enroll in the Apple Developer Program at developer.apple.com (99 USD/yr).
   Choose individual or company. Company enrollment needs a D-U-N-S number and
   takes longer; individual enrollment is fast. You need an Apple ID with
   two-factor authentication turned on.

2. In App Store Connect (appstoreconnect.apple.com), create a new App record.
   Pick the bundle identifier, which must match the app's. scribl currently uses
   `com.hs2studio.scribl` (set in app.json). Keep a stable reverse-DNS bundle id
   like this one. Set the app name, primary language, and SKU.

3. Produce a signed build. scribl's project rule is OSS-only: do NOT use EAS
   (Expo's hosted Build / Submit service). Builds and CI/CD live in AWS. Two
   routes that respect that:
   - Local Xcode (simplest to start): open the prebuilt `ios/scribl.xcworkspace`,
     sign in with the Apple Developer account and set the signing team, choose
     Product -> Archive, then Distribute App -> App Store Connect -> Upload. The
     archive shows up in App Store Connect after processing.
   - Automated in AWS CI: run `xcodebuild archive` then `xcodebuild
     -exportArchive` on a macOS runner, and upload with `xcrun altool`
     (or `xcrun notarytool` / `fastlane pilot`) to App Store Connect. This is the
     repeatable path once the manual route is proven, and keeps builds off any
     Expo cloud service.

   Note: TestFlight itself is part of App Store Connect (Apple), not EAS, so
   using TestFlight as the distribution channel is fully compatible with the
   no-EAS rule. Only the build/upload mechanics need to avoid EAS.

4. In App Store Connect -> your app -> TestFlight tab: once the build finishes
   processing, add it to a test group. For internal testers, add App Store
   Connect users; they get it immediately. For external testers, create a group,
   add testers by email or enable a public link, then submit the build for the
   (usually quick) external-testing review.

5. Testers install the TestFlight app from the App Store, open the invite email
   or public link, and tap Install. Builds auto-expire after 90 days; upload a
   fresh build to renew.

For scribl, the manual Xcode archive route is the fastest way to get the first
TestFlight build out. Once it works by hand, script it with `xcodebuild` on an
AWS macOS runner so releases are repeatable, without introducing EAS.

## Local build status: VERIFIED on the iOS Simulator

The full local build path is proven end to end. scribl builds and launches on
the iOS Simulator against the local backend. Confirmed:

- Toolchain: Xcode 26.6 active, CocoaPods 1.17.0.
- `ios.bundleIdentifier` = `com.hs2studio.scribl` set in app.json (symmetric with
  the Android package).
- `expo prebuild --platform ios` -> `pod install` (103 pods) ->
  `npx expo run:ios` compiled the app (ReactCodegen, Skia, Reanimated, SVG, etc.)
  and launched it on an iPhone 17 Simulator running iOS 26.5. The app ran.
- The Simulator reaches the local backend at `localhost:8787` automatically.

### What it took to get here (for reproducing on a fresh machine)

1. Activate Xcode (needs admin/sudo; Xcode.app must be installed):
   ```sh
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -license accept
   xcodebuild -version   # verify
   ```
2. Install an iOS Simulator runtime. Xcode 26 ships the iOS SDK but NOT a
   bootable simulator runtime, so a fresh Xcode has zero simulator devices and
   `expo run:ios` fails with "No iOS devices available." Download it once (about
   8.5 GB, no admin needed):
   ```sh
   xcodebuild -downloadPlatform iOS
   ```
3. From vendor/mobileapp: `npx expo run:ios`. If the shell has a stale
   `DEVELOPER_DIR` pointing at the Command Line Tools, override it:
   `export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`.

### Still needed only for distributing to OTHER people

Running on the Simulator (or your own device) needs no Apple account. To hand a
build to anyone else you still need the 99 USD/yr Apple Developer Program, and
TestFlight is the recommended channel (see the steps above).

## Backend connectivity for iOS testers

A note that trips people up when moving from Android to iOS:

- The iOS Simulator reaches a backend running on the host at `localhost` /
  `127.0.0.1`. It does NOT use `10.0.2.2`; that is the Android emulator
  convention.
- A physical iPhone on the same LAN uses the host's LAN IP, for example
  `http://192.168.68.52:8787`, exactly like the Android phone does.
- A TestFlight or ad-hoc build handed to a remote tester CANNOT reach a backend
  running on Rob's laptop at all. It needs a publicly reachable backend URL baked
  into the build at bundle time (via `EXPO_PUBLIC_*` environment variables).

Treat the backend URL as a real consideration for any tester build: a remote
tester with no route to your dev machine will see a broken app unless the build
points at a hosted backend.
