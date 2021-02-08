const express = require("express");
const Message = require("../models/message");
const User = require("../models/user");
const ExpressError = require("../expressError");

const router = new express.Router();

/** GET /:id - get detail of message.
 *
 * => {message: {id,
 *               body,
 *               sent_at,
 *               read_at,
 *               from_user: {username, first_name, last_name, phone},
 *               to_user: {username, first_name, last_name, phone}}
 *
 * Make sure that the currently-logged-in users is either the to or from user.
 *
 **/

router.get("/:id", async (req, res, next) => {
  try {
    const message = await Message.get(req.params.id);
    // verify user and has either sent or received the message
    if (message.from_user.username !== req.user.username &&
      message.to_user.username !== req.user.username) {
      const expressError = new ExpressError("Unauthorized access", 401);
      return next(expressError);
    }
    return res.send({ message });
  }
  catch(err) {
    return next(err);
  }
});

/** POST / - post message.
 *
 * {to_username, body} =>
 *   {message: {id, from_username, to_username, body, sent_at}}
 *
 **/

router.post("/", async (req, res, next) => {
  try {
    const { to_username, body } = req.body;
    if (!to_username || !body) {
      const expressError = new ExpressError(
        "Missing paramters. Enter both to_username and body",
        400
      );
      return next(expressError);
    }
    // verify to_username exists
    try {
      await User.get(to_username);
    }
    catch(err) {
      const expressError = new ExpressError(err.message, 400);
      return next(expressError);
    }
    const from_username = req.user.username;
    // verify to_username isn't from_username
    if (from_username == to_username) {
      const expressError = new ExpressError(
        "Can't send a message to yourself",
        400
      );
      return next(expressError);
    }
    const message = await Message.create({ from_username, to_username, body });
    return res.status(201).send({ message });
  }
  catch(err) {
    return next(err);
  }
});

/** POST/:id/read - mark message as read:
 *
 *  => {message: {id, read_at}}
 *
 * Make sure that the only the intended recipient can mark as read.
 *
 **/

router.post("/:id/read", async (req, res, next) => {
  try {
    // verify user is receiver of message
    let message = await Message.get(req.params.id);
    if (req.user.username !== message.to_user.username) {
      const expressError = new ExpressError("Unauthorized access", 401);
      return next(expressError);
    }
    message = await Message.markRead(req.params.id);
    return res.send({ message });
  }
  catch(err) {
    return next(err);
  }
});

module.exports = router;