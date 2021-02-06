const bcrypt = require("bcrypt");
const db = require("../db");
const { BCRYPT_WORK_FACTOR } = require("../config");
const { user } = require("../db");

/** User class for message.ly */



/** User of the site. */

class User {

  /** register new user -- returns
   *    {username, password, first_name, last_name, phone}
   */

  static async register({username, password, first_name, last_name, phone}) {
    // encrypt password
    const hashedPassword = await bcrypt.hash(password, BCRYPT_WORK_FACTOR);

    // add to database
    const result = await db.query(`
      INSERT INTO users
        (
          username,
          password,
          first_name,
          last_name,
          phone,
          join_at,
          last_login_at
        )
        VALUES ($1, $2, $3, $4, $5, current_timestamp, current_timestamp)
        RETURNING username, password, first_name, last_name, phone
    `, [username, hashedPassword, first_name, last_name, phone]);

    return result.rows[0];
  }

  /** Authenticate: is this username/password valid? Returns boolean. */

  static async authenticate(username, password) {
    // get hashed password
    const result = await db.query(`
      SELECT password FROM users WHERE username=$1
    `, [username]);
    // if didn't get any results, invalid username
    if (!result.rows[0]) {
      return false;
    }
    const { password: hashedPassword } = result.rows[0];

    // verify password matches hashed password
    return await bcrypt.compare(password, hashedPassword);
  }

  /** Update last_login_at for user */

  static async updateLoginTimestamp(username) {
    await db.query(`
      UPDATE users SET last_login_at=current_timestamp WHERE username=$1
    `, [username]);
  }

  /** All: basic info on all users:
   * [{username, first_name, last_name, phone}, ...] */

  static async all() {
    const result = await db.query(`
      SELECT username, first_name, last_name, phone FROM users
    `);
    return result.rows;
  }

  /** Get: get user by username
   *
   * returns {username,
   *          first_name,
   *          last_name,
   *          phone,
   *          join_at,
   *          last_login_at } */

  static async get(username) {
    const result = await db.query(`
      SELECT username, first_name, last_name, phone, join_at, last_login_at
        FROM users WHERE username=$1
    `, [username]);
    // if no user, username is invalid
    if (!result.rows[0]) {
      throw new Error("User doesn't exist");
    }
    return result.rows[0];
  }

  /** Return messages from this user.
   *
   * [{id, to_user, body, sent_at, read_at}]
   *
   * where to_user is
   *   {username, first_name, last_name, phone}
   */

  static async messagesFrom(username) {
    const result = await db.query(`
      SELECT
        id,
        tu.username,
        tu.first_name,
        tu.last_name,
        tu.phone,
        body,
        sent_at,
        read_at
        FROM messages m JOIN users fu ON m.from_username=fu.username JOIN
        users tu ON m.to_username=tu.username WHERE fu.username=$1
    `, [username]);
    const messages = result.rows.map(message => ({
      id: message.id,
      to_user: {
        username: message.username,
        first_name: message.first_name,
        last_name: message.last_name,
        phone: message.phone
      },
      body: message.body,
      sent_at: message.sent_at,
      read_at: message.read_at
    }));
    return messages;
  }

  /** Return messages to this user.
   *
   * [{id, from_user, body, sent_at, read_at}]
   *
   * where from_user is
   *   {username, first_name, last_name, phone}
   */

  static async messagesTo(username) {
    const result = await db.query(`
      SELECT
        id,
        fu.username,
        fu.first_name,
        fu.last_name,
        fu.phone,
        body,
        sent_at,
        read_at
        FROM messages m JOIN users tu ON m.to_username=tu.username JOIN
        users fu ON m.from_username=fu.username WHERE tu.username=$1
    `, [username]);
    const messages = result.rows.map(message => ({
      id: message.id,
      from_user: {
        username: message.username,
        first_name: message.first_name,
        last_name: message.last_name,
        phone: message.phone
      },
      body: message.body,
      sent_at: message.sent_at,
      read_at: message.read_at
    }));
    return messages;
  }
}

module.exports = User;