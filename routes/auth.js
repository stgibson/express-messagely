const express = require("express");
const jwt = require("jsonwebtoken");
const ExpressError = require("../expressError");
const { SECRET_KEY } = require("../config");
const User = require("../models/user");
const { route } = require("../app");
const { compareSync } = require("bcrypt");

const router = new express.Router();

/** POST /login - login: {username, password} => {token}
 *
 * Make sure to update their last-login!
 *
 **/
router.post("/login", async (req, res, next) => {
  // validate username and password
  const { username, password } = req.body;
  if (!username || !password) {
    const expressError = new ExpressError(
      "Submit both username and password",
      400
    );
    return next(expressError);
  }
  try {
    // if valid credentials
    if (await User.authenticate(username, password)) {
      // update last-login
      await User.updateLoginTimestamp(username);

      // generate token
      const payload = { username };
      const token = jwt.sign(payload, SECRET_KEY);
      return res.status(200).send({ token });
    }
  }
  catch(err) {
    return next(err);
  }
  // otherwise, throw error
  const expressError = new ExpressError("Invalid credentials", 400);
  return next(expressError);
});


/** POST /register - register user: registers, logs in, and returns token.
 *
 * {username, password, first_name, last_name, phone} => {token}.
 *
 *  Make sure to update their last-login!
 */
router.post("/register", async (req, res, next) => {
  try {
    const { username, password, first_name, last_name, phone } = req.body;
    if (!username || !password || !first_name || !last_name || !phone) {
      const expressError = new ExpressError(
        "Submit username, password, first_name, last_name, and phone",
        400
      );
      return next(expressError);
    }
    await User.register({username, password, first_name, last_name, phone});
    await User.updateLoginTimestamp(username);

    // generate token
    const payload = { username };
    const token = jwt.sign(payload, SECRET_KEY);
    return res.status(201).send({ token });
  }
  catch(err) {
    return next(err);
  }
});

module.exports = router;