// Global manual mock for AsyncStorage. Jest auto-applies root __mocks__ for
// node_modules, so every test gets the in-memory mock instead of the native
// module (which throws when required outside a device). This mirrors the
// per-test `jest.mock(... jest/async-storage-mock)` the store tests already use
// and unblocks screens that transitively import useThemeStore (e.g. via the
// scribble ScribbleBackdrop) without each test having to mock the store.
module.exports = require("@react-native-async-storage/async-storage/jest/async-storage-mock");
