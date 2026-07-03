const mongoose = require("mongoose");
const schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose").default;
const userSchema = new schema({

    emailId: {
        type: String,
        required: true,
    }
});
// passportLocalMongoose user name and hash and salting automatically add krta hai.
userSchema.plugin(passportLocalMongoose);
const User = mongoose.model("User", userSchema);
module.exports = User;

