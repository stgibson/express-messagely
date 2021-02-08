const request = require("supertest");
const app = require("../app");
const db = require("../db");
const User = require("../models/user");
const Message = require("../models/message");


describe("Test Message class", function () {

  beforeEach(async function () {
    await db.query("DELETE FROM messages");
    await db.query("DELETE FROM users");
    await db.query("ALTER SEQUENCE messages_id_seq RESTART WITH 1");

    let u1 = await User.register({
      username: "test1",
      password: "password",
      first_name: "Test1",
      last_name: "Testy1",
      phone: "+14155550000",
    });
    let u2 = await User.register({
      username: "test2",
      password: "password",
      first_name: "Test2",
      last_name: "Testy2",
      phone: "+14155552222",
    });
    let m1 = await Message.create({
      from_username: "test1",
      to_username: "test2",
      body: "u1-to-u2"
    });
    let m2 = await Message.create({
      from_username: "test2",
      to_username: "test1",
      body: "u2-to-u1"
    });
  });

  test("can create", async function () {
    let m = await Message.create({
      from_username: "test1",
      to_username: "test2",
      body: "new"
    });

    expect(m).toEqual({
      id: expect.any(Number),
      from_username: "test1",
      to_username: "test2",
      body: "new",
      sent_at: expect.any(Date),
    });
  });

  test("can mark read", async function () {
    let m = await Message.create({
      from_username: "test1",
      to_username: "test2",
      body: "new"
    });
    expect(m.read_at).toBe(undefined);

    Message.markRead(m.id);
    const result = await db.query("SELECT read_at from messages where id=$1",
        [m.id]);
    expect(result.rows[0].read_at).toEqual(expect.any(Date));
  });

  test("can get", async function () {
    let u = await Message.get(1);
    expect(u).toEqual({
      id: expect.any(Number),
      body: "u1-to-u2",
      sent_at: expect.any(Date),
      read_at: null,
      from_user: {
        username: "test1",
        first_name: "Test1",
        last_name: "Testy1",
        phone: "+14155550000",
      },
      to_user: {
        username: "test2",
        first_name: "Test2",
        last_name: "Testy2",
        phone: "+14155552222",
      },
    });
  });
});

describe("Message Routes Test", function () {
  beforeEach(async function () {
    await db.query("DELETE FROM messages");
    await db.query("DELETE FROM users");

    let u1 = await User.register({
      username: "test1",
      password: "password",
      first_name: "Test1",
      last_name: "Testy1",
      phone: "+14155550000"
    });
    let u2 = await User.register({
      username: "test2",
      password: "password",
      first_name: "Test2",
      last_name: "Testy2",
      phone: "+14155550001"
    });
    let u3 = await User.register({
      username: "test3",
      password: "password",
      first_name: "Test3",
      last_name: "Testy3",
      phone: "+14155550002"
    });
    let m1 = await Message.create({
      from_username: "test1",
      to_username: "test2",
      body: "u1-to-u2"
    });
    let m2 = await Message.create({
      from_username: "test2",
      to_username: "test1",
      body: "u2-to-u1"
    });
  });

  /** 
   * GET /messages/:id =>
   * {message: {id,
   *            body,
   *            sent_at,
   *            read_at,
   *            from_user: {username, first_name, last_name, phone},
   *            to_user: {username, first_name, last_name, phone}}
   */

  describe("GET /messages/:id", function () {
    test("can get message if user sent message", async function () {
      // first log in u1
      const response1 = await request(app).post("/auth/login")
        .send({ username: "test1", password: "password" });
      let { token } = response1.body;

      // get id of m1
      const result = await db.query(`
        SELECT id FROM messages WHERE from_username='test1'
      `);
      const { id } = result.rows[0];
      // then, make request with token
      const response2 = await request(app).get(`/messages/${id}`)
        .send({ _token: token });
      expect(response2.statusCode).toEqual(200);
      const { message } = response2.body;
      expect(message).toEqual({
        id,
        body: "u1-to-u2",
        sent_at: expect.any(String),
        read_at: null,
        from_user: {
          username: "test1",
          first_name: "Test1",
          last_name: "Testy1",
          phone: "+14155550000"
        },
        to_user: {
          username: "test2",
          first_name: "Test2",
          last_name: "Testy2",
          phone: "+14155550001"
        }
      });
    });

    test("can get message if user received message", async function () {
      // first log in u1
      const response1 = await request(app).post("/auth/login")
        .send({ username: "test1", password: "password" });
      let { token } = response1.body;

      const result = await db.query(`
        SELECT id FROM messages WHERE to_username='test1'
      `);
      const { id } = result.rows[0];

      // then, make request with token
      const response2 = await request(app).get(`/messages/${id}`)
        .send({ _token: token });
      expect(response2.statusCode).toEqual(200);
      const { message } = response2.body;
      expect(message).toEqual({
        id,
        body: "u2-to-u1",
        sent_at: expect.any(String),
        read_at: null,
        from_user: {
          username: "test2",
          first_name: "Test2",
          last_name: "Testy2",
          phone: "+14155550001"
        },
        to_user: {
          username: "test1",
          first_name: "Test1",
          last_name: "Testy1",
          phone: "+14155550000"
        }
      });
    });

    test("can't get message if not logged in", async function () {
      // get id of m1
      const result = await db.query(`
      SELECT id FROM messages WHERE to_username='test1'
      `);
      const { id } = result.rows[0];

      const response = await request(app).get(`/users/${id}`)
        .send({ _token: "badtoken" });
      expect(response.statusCode).toEqual(401);
    });

    test("can't get message if not sender or received", async function () {
      // first log in u3
      const response1 = await request(app).post("/auth/login")
        .send({ username: "test3", password: "password" });
      let { token } = response1.body;

      // get id of m1
      const result = await db.query(`
        SELECT id FROM messages WHERE to_username='test1'
      `);
      const { id } = result.rows[0];

      // then, make request with token
      const response2 = await request(app).get(`/messages/${id}`)
        .send({ _token: token });
      expect(response2.statusCode).toEqual(401);
    });

    test("can't get message that doesn't exist", async function () {
      // first log in u1
      const response1 = await request(app).post("/auth/login")
        .send({ username: "test1", password: "password" });
      let { token } = response1.body;

      const response2 = await request(app).get("/messages/0")
        .send({ _token: token });
      expect(response2.statusCode).toEqual(404);
    });
  });

  /**
   * POST /messages/ =>
   * {message: {id, from_username, to_username, body, sent_at}}
   */

  describe("POST /messages/", function () {
    test("can send message if logged in", async function () {
      // first log in u1
      const response1 = await request(app).post("/auth/login")
        .send({ username: "test1", password: "password" });
      let { token } = response1.body;

      // then, make request with token
      const response2 = await request(app).post("/messages/")
        .send({ _token: token, to_username: "test2", body: "Test Message" });
      expect(response2.statusCode).toEqual(201);
      const { message } = response2.body;
      expect(message).toEqual({
          id: expect.any(Number),
          from_username: "test1",
          to_username: "test2",
          body: "Test Message",
          sent_at: expect.any(String)
      });
    });

    test("can't send message to user that doesn't exist", async function () {
      // first log in u1
      const response1 = await request(app).post("/auth/login")
        .send({ username: "test1", password: "password" });
      let { token } = response1.body;

      // then, make request with token
      const response2 = await request(app).post("/messages/")
        .send({ _token: token, to_username: "baduser", body: "Test Message" });
      expect(response2.statusCode).toEqual(400);
    });

    test("can't send message if missing parameters", async function () {
      // first log in u1
      const response1 = await request(app).post("/auth/login")
        .send({ username: "test1", password: "password" });
      let { token } = response1.body;

      // try to send message without including to_username
      const response2 = await request(app).post("/messages/")
        .send({ _token: token, body: "Test Message" });
      expect(response2.statusCode).toEqual(400);

      // try to send message without including body
      const response3 = await request(app).post("/messages/")
        .send({ _token: token, to_username: "test2" });
      expect(response3.statusCode).toEqual(400);
    });

    test("can't send message to self", async function () {
      // first log in u1
      const response1 = await request(app).post("/auth/login")
        .send({ username: "test1", password: "password" });
      let { token } = response1.body;

      // then, make request with token
      const response2 = await request(app).post("/messages/")
        .send({ _token: token, to_username: "test1", body: "Test Message" });
      expect(response2.statusCode).toEqual(400);
    });

    test("can't send message if not logged in", async function () {
      const response = await request(app).post("/messages/").send({
        _token: "badtoken",
        to_username: "test2",
        body: "Test Message"
      });
      expect(response.statusCode).toEqual(401);
    });
  });

  /**
   * POST /messages/:id/read => {message: {id, read_at}}
   */

  describe("POST /messages/:id/read", function () {
    test("can read message user received", async function () {
      // first log in u1
      const response1 = await request(app).post("/auth/login")
        .send({ username: "test1", password: "password" });
      let { token } = response1.body;

      // get id of m2
      const result = await db.query(`
        SELECT id FROM messages WHERE to_username='test1'
      `);
      const { id } = result.rows[0];

      // then, make request with token
      const response2 = await request(app).post(`/messages/${id}/read`)
        .send({ _token: token });
      expect(response2.statusCode).toEqual(200);
      const { message } = response2.body;
      expect(message).toEqual({
        id,
        read_at: expect.any(String)
      });
    });

    test("can't read message user sent", async function () {
      // first log in u1
      const response1 = await request(app).post("/auth/login")
        .send({ username: "test1", password: "password" });
      let { token } = response1.body;

      // get id of m1
      const result = await db.query(`
        SELECT id FROM messages WHERE from_username='test1'
      `);
      const { id } = result.rows[0];

      // then, make request with token
      const response2 = await request(app).post(`/messages/${id}/read`)
        .send({ _token: token });
      expect(response2.statusCode).toEqual(401);
    });

    test("can't read message user didn't send or receive", async function () {
      // first log in u3
      const response1 = await request(app).post("/auth/login")
        .send({ username: "test3", password: "password" });
      let { token } = response1.body;

      // get id of m1
      const result = await db.query(`
        SELECT id FROM messages WHERE from_username='test1'
      `);
      const { id } = result.rows[0];

      const response2 = await request(app).post(`/messages/${id}/read`)
        .send({ _token: token });
      expect(response2.statusCode).toEqual(401);
    });

    test("can read message if not logged in", async function () {
      // get id of m2
      const result = await db.query(`
        SELECT id FROM messages WHERE to_username='test1'
      `);
      const { id } = result.rows[0];

      // then, make request with token
      const response2 = await request(app).post(`/messages/${id}/read`)
        .send({ _token: "badtoken" });
      expect(response2.statusCode).toEqual(401);
    });

    test("can read message that doesn't exist", async function () {
      // first log in u1
      const response1 = await request(app).post("/auth/login")
        .send({ username: "test1", password: "password" });
      let { token } = response1.body;

      // then, make request with token
      const response2 = await request(app).post(`/messages/0/read`)
        .send({ _token: token });
      expect(response2.statusCode).toEqual(404);
    });
  });
});

afterAll(async function() {
  await db.end();
});
