const mongoose = require("mongoose");
const Listing = require("../models/listing");
const initdata = require("./data.js");

main()
.then(() => {
    console.log("Connected to MongoDB");
})
    .catch((err) => {
    console.error("Error connecting to MongoDB", err);
});
async function main() {
    await mongoose.connect("mongodb://127.0.0.1:27017/wanderlust");
}



const initDB = async () => {
    await Listing.deleteMany({});
    initdata.data = initdata.data.map((obj) => ({...obj, owner: "6a3dec0a82e1ee69601cb3f7"}));
    await Listing.insertMany(initdata.data);
    console.log("Database initialized with sample data");
};

initDB();
