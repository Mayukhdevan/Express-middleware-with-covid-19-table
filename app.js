const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => console.log("Server listening at port 3000..."));
  } catch (err) {
    console.log(`DB error: ${err.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

//User Login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// Middleware function to authenticate token
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username; // Pass data to the next handler with request obj
        next(); // Call the next handler or middleware
      }
    });
  }
};

// GET API: Returns a list of all states in the state table.
app.get("/states/", authenticateToken, async (req, res) => {
  const getStatesQuery = `
        SELECT
          *
        FROM
          state
        ORDER BY
          state_id;`;
  const stateArray = await db.all(getStatesQuery);
  res.send(
    stateArray.map((stateObj) => ({
      stateId: stateObj.state_id,
      stateName: stateObj.state_name,
      population: stateObj.population,
    }))
  );
});

// GET API: Returns a sate based on the sate ID.
app.get("/states/:stateId/", authenticateToken, async (req, res) => {
  const { stateId } = req.params;

  const getStateQuery = `
        SELECT * FROM
          state
        WHERE
          state_id = ${stateId};`;

  const stateDetails = await db.get(getStateQuery);

  res.send({
    stateId: stateDetails.state_id,
    stateName: stateDetails.state_name,
    population: stateDetails.population,
  });
});

// POST API: Creates a district in the district table.
app.post("/districts/", authenticateToken, async (req, res) => {
  const districtDetails = req.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;

  const postDistrictsQuery = `
          INSERT INTO
            district (district_name, state_id, cases, cured, active, deaths)
          VALUES
            ('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});`;

  await db.run(postDistrictsQuery);
  res.send("District Successfully Added");
});

// GET API: Returns a district based on the district ID.
app.get("/districts/:districtId/", authenticateToken, async (req, res) => {
  const { districtId } = req.params;

  const getDistrictQuery = `
        SELECT * FROM
          district
        WHERE
          district_id = ${districtId};`;

  const districtDetails = await db.get(getDistrictQuery);

  res.send({
    districtId: districtDetails.district_id,
    districtName: districtDetails.district_name,
    stateId: districtDetails.state_id,
    cases: districtDetails.cases,
    cured: districtDetails.cured,
    active: districtDetails.active,
    deaths: districtDetails.deaths,
  });
});

// DELETE API: Deletes a district from the district table based on the district ID.
app.delete("/districts/:districtId/", authenticateToken, async (req, res) => {
  const { districtId } = req.params;

  const deleteDistrictQuery = `
      DELETE FROM
        district
      WHERE
        district_id = ${districtId};`;

  await db.run(deleteDistrictQuery);
  res.send("District Removed");
});

// PUT API: Updates the details of a specific district based on the district ID.
app.put("/districts/:districtId/", authenticateToken, async (req, res) => {
  const { districtId } = req.params;
  const districtDetails = req.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;

  const updateDistrictQuery = `
    UPDATE
      district
    SET
      district_name = '${districtName}',
      state_id = ${stateId},
      cases = ${cases},
      cured = ${cured},
      active = ${active},
      deaths = ${deaths}
    WHERE
      district_id = ${districtId};`;

  await db.run(updateDistrictQuery);
  res.send("District Details Updated");
});

// GET API: Returns a list of all directors in the director table.
app.get("/states/:stateId/stats/", authenticateToken, async (req, res) => {
  const { stateId } = req.params;

  const getStateQuery = `
        SELECT
          SUM(cases) AS totalCases,
          SUM(cured) AS totalCured,
          SUM(active) AS totalActive,
          SUM(deaths) AS totalDeaths
        FROM
          district
        WHERE
          state_id = ${stateId};`;

  const stateObj = await db.get(getStateQuery);
  res.send(stateObj);
});

module.exports = app;
