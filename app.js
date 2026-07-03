if(process.env.NODE_ENV !== "production") {
  require('dotenv').config();
}


const express = require("express");
const app = express();
const mongoose = require("mongoose");
const Listing = require("./models/listing.js");
const Review = require("./models/review.js");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const { error } = require("console");
const wrapAsync = require("./utils/wrapAsync.js");
const ExpressError = require("./utils/ExpressError.js");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");
const flash = require("connect-flash");
const { isOwner, isLoggedIn, validateListing, validateReview, isReviewOwner} = require("./middleware.js");
const multer = require("multer");
const { storage } = require("./cloudconfig.js");
const upload = multer({ storage: storage });
const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const mapBoxToken = process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapBoxToken }); 
const MongoStore = require("connect-mongo");




// const MONGO_URL = "mongodb://127.0.0.1:27017/wanderlust";
const dbUrl = process.env.ATLASdb_URL;

main()
  .then(() => {
    console.log("connected to DB");
  })
  .catch((err) => {
    console.log(err);
  });

async function main() {
  await mongoose.connect(dbUrl);
}


app.engine("ejs", ejsMate);
app.use(methodOverride("_method"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

const store = MongoStore.create({
  mongoUrl: dbUrl,
  crypto: {
    secret: process.env.SECRET,
  },
  touchAfter: 24 * 60 * 60,
});

store.on("error", function (e) {
  console.log("session store error", e);
});

app.use(session({
  store: store,
  secret:  process.env.SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge:  7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
  },
}));

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(flash());

app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  next();
});






//signup
app.get("/signup", (req, res) => {
  res.render("user/singedup");
});

app.post("/signup", wrapAsync(async (req, res) => {
  try{
  let { username, emailId, password } = req.body;
  let newUser = new User({ username, emailId });
  const registeredUser = await User.register(newUser, password);
  req.login(registeredUser, (err) => {
    if(err) {
      next(err);
    }
     req.flash("success","Welcome to wanderlust! You are logged in!");
  res.redirect("/listings");

  }
  );
  }catch(e){
    req.flash("error", e.message);
    res.redirect("/signup");
  }
}));




//login
app.get("/login", (req, res) => {
  res.render("user/login");
});

app.post("/login",
  passport.authenticate("local", {
  failureRedirect: "/login",
  failureFlash: true,
}), async (req, res) => {
  req.flash("success","Welcome to wanderlust! You are logged in!");
  res.redirect("/listings");

});





//logout
app.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if(err) {
      return next(err);
    }
    req.flash("success", "you are logged Out!");
    res.redirect("/listings");
  });
});

// app.get("/", (req, res) => {
//   res.send("Hi, I am root");
// });




//Index Route
app.get("/listings", async (req, res) => {
  const allListings = await Listing.find({});
  res.render("listing/index", { allListings });
});


//new lising form
app.get("/listings/new", isLoggedIn, (req, res) => {
  res.render("listing/new");
});

app.post("/listings/new/save",isLoggedIn, validateListing, upload.single("listing[image]"), wrapAsync(async (req, res, next) => {
  
  let response = await geocodingClient
  .forwardGeocode({
    query: req.body.listing.location,
    limit: 1
  }).send();
  
  let url = req.file.path;
  let filename = req.file.filename;
  
  const newlisting = new Listing(req.body.listing);
  newlisting.owner = req.user._id;
  newlisting.image = { url, filename };
  newlisting.geometry = response.body.features[0].geometry;

  await newlisting.save();
  req.flash("success", "Listing created successfully!");
  res.redirect("/listings");
  
  
}));


// Show listing details
app.get("/listings/:id", wrapAsync(async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id).populate("owner").populate({"path": "reviews", "populate": {"path": "author"}});
  res.render("listing/showlisting", { listing });
}));



//edit listing
app.get("/listings/edit/:id", wrapAsync(async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id);
  let originalUrl = listing.image.url;
 originalUrl = originalUrl.replace("/upload", "/upload/w_250,h_300,");
 

  res.render("listing/edit", { listing, originalUrl });
})); 

app.put("/listings/update/:id",isLoggedIn, isOwner, validateListing, upload.single("listing[image]"), wrapAsync(async (req, res) => {
  const { id } = req.params;
  const updatedListing = await Listing.findByIdAndUpdate(id, { ...req.body.listing });

  if(typeof req.file !== "undefined") {
   let url = req.file.path;
   let filename = req.file.filename;
    updatedListing.image = { url, filename };
    await updatedListing.save(); 
  }
  req.flash("success", "Listing updated successfully!");
  res.redirect(`/listings/${id}`);
}));



//delete listing
app.delete("/listings/delete/:id", wrapAsync(async (req, res) => {
  const { id } = req.params;
  let listing = await Listing.findById(id);
  if(!listing.owner._id.equals(res.locals.currUser._id)) {
    req.flash("error", "you don't have permission to Delete this listing");
    return res.redirect(`/listings/${id}`);
  }
  await Listing.findByIdAndDelete(id);
  console.log("listing deleted successfully");
  res.redirect("/listings");
}));


//review route
app.post("/listings/:id/review",isLoggedIn, validateReview, wrapAsync( async (req,  res) => {

   if(!req.body.review) {
      req.flash("error", "Review cannot be empty");
      return res.redirect(`/listings/${id}`);
    }
  let { id } = req.params;
  let listing = await Listing.findById(id);
  
  let { rating, comment } = req.body.review;
  let newReview = new Review({ rating, comment});
  newReview.author = req.user._id;
  listing.reviews.push(newReview);
  await listing.save();
  await newReview.save();
  console.log("save review");

  res.redirect(`/listings/${id}`);
}));

//review delete
app.delete("/listings/:id/review/:reviewId", isReviewOwner, wrapAsync( async (req,res) => {
  const { id, reviewId } = req.params;
  await Listing.findByIdAndUpdate(id, {$pull : {reviews: reviewId}});
  await Review.findByIdAndDelete(reviewId);
  res.redirect(`/listings/${id}`);
}));


//search r
app.get("/search", async (req, res) => {
    let { location } = req.query;

    const listings = await Listing.find({
        location: {
            $regex: location,
            $options: "i"   // case-insensitive
        }
    });

    res.render("listing/index.ejs", { allListings: listings });
});


app.use((req, res, next) => {
  next(new ExpressError(404, "page not Found!"));
});

app.use((err, req, res, next) => {
  let { statusCode = 500, message = "something want wrong" } = err;
  res.status(statusCode).render("Error/error.ejs", { err });
});


app.listen(8080, () => {
  console.log("server is listening to port 8080");
});
