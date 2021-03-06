module.exports = {
  "extends": [
    "airbnb-base"
  ],
  "parser": "babel-eslint",
  "env": {
    "browser": true,
    "webextensions": true,
    "mocha": true
  },
  "rules": {
    "comma-dangle": [
      1,
      "always-multiline"
    ],
    "linebreak-style": [
      "off"
    ],
    "no-underscore-dangle": 0,
    "max-len": [
      1,
      180,
      4
    ],
    "arrow-body-style": [
      0
    ]
  }
}