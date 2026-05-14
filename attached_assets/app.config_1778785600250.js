const baseConfig = require("./app.json");

module.exports = ({ config }) => ({
  ...baseConfig.expo,
  extra: {
    firebaseApiKey: process.env.GOOGLE_API_KEY ?? "",
    firebaseAuthDomain: "mineral-resonance.firebaseapp.com",
    firebaseProjectId: "mineral-resonance",
    firebaseStorageBucket: "mineral-resonance.firebasestorage.app",
    firebaseMessagingSenderId: "190347227688",
    firebaseAppId: "1:190347227688:web:a7d8dae3f5c6c74bdcbb1d",
    firebaseMeasurementId: "G-FDKRRRZ2GK",
  },
});
