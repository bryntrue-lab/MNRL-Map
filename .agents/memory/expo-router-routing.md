---
name: Expo Router routing gotchas
description: Tab-group navigation and profile-cache races that mis-route users
---

- `router.replace("/(tabs)")` can land on the group's `index` route (Today), NOT the declared `initialRouteName` (Origin). **How to apply:** always navigate to the explicit tab, e.g. `/(tabs)/origin`, when a specific tab is the contract.
- Profile-driven entry routing (new-user vs returning) must never read a cross-user cache. **Why:** UserContext once cached the profile under a single AsyncStorage key; after sign-out → fresh anon uid, the old profile hydrated first and mis-routed. Fixed: cache key per uid + reset profile/loading on uid change + ignore cache once live snapshot arrived.
