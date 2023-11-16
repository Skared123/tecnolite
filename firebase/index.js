const path = require("path");
const { Firestore } = require("@google-cloud/firestore");

const options = {
  keyFilename: path.resolve(__dirname, "./dev_service_account.json"),
  projectId: "voltz-develop",
};

module.exports = new Firestore(options);