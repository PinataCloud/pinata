"use strict";

const pinata = require("pinata");
const LegacyPinataSDK = require("./legacy.js");

module.exports = Object.assign(LegacyPinataSDK, pinata);
