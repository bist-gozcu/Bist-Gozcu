require('./patches/node-polyfill');
const { getDefaultConfig } = require("expo/metro-config");

module.exports = getDefaultConfig(__dirname);
