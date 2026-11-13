import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../../config/env.js";
import { pool } from "../../config/database.js";
import type { LoginInput, RegistrationInput } from "./auth.schema.js";

type OrganisationAccountType = Exclude<
  RegistrationInput["accountType"],
  "individual"
>;

const organisationTypeMap: Record<
  OrganisationAccountType,
  "business" | "psp_operator" | "recycling_facility" | "hospital" | "pharmacy"
> = {
  business: "business",
  psp: "psp_operator",
  recycler: "recycling_facility",
  hospital: "hospital",
  pharmacy: "pharmacy",
};

export type RegistrationResult = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  accountType: RegistrationInput["accountType"];
  organisation?: {
    id: string;
    name: string;
    type: string;
  };
};

export async function registerUser(
  input: RegistrationInput,
): Promise<RegistrationResult> {
  const passwordHash = await bcrypt.hash(input.password, 12);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query<{
      id: string;
      email: string;
      first_name: string;
      last_name: string;
    }>(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, first_name, last_name`,
      [
        input.email,
        passwordHash,
        input.firstName,
        input.lastName,
        input.phone ?? null,
      ],
    );

    const user = userResult.rows[0];

    if (!user) {
      throw new Error("User creation did not return a record.");
    }

    if (input.accountType === "individual") {
      await client.query("COMMIT");

      return {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        accountType: "individual",
      };
    }

    const organisationType = organisationTypeMap[input.accountType];

    const organisationResult = await client.query<{
      id: string;
      name: string;
    }>(
      `INSERT INTO organisations
         (name, organisation_type, contact_email, contact_phone, service_area)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name`,
      [
        input.organisationName,
        organisationType,
        input.email,
        input.phone ?? null,
        input.serviceArea ?? null,
      ],
    );

    const organisation = organisationResult.rows[0];

    if (!organisation) {
      throw new Error("Organisation creation did not return a record.");
    }

    await client.query(
      `INSERT INTO organisation_members (organisation_id, user_id, role)
       VALUES ($1, $2, 'owner')`,
      [organisation.id, user.id],
    );

    await client.query("COMMIT");

    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      accountType: input.accountType,
      organisation: {
        id: organisation.id,
        name: organisation.name,
        type: organisationType,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new Error("An account with this email already exists.");
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function loginUser(input: LoginInput) {
  const result = await pool.query<{
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    password_hash: string;
    is_active: boolean;
  }>(
    `SELECT id, email, first_name, last_name, password_hash, is_active
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [input.email],
  );

  const user = result.rows[0];

  if (!user || !user.is_active) {
    throw new Error("Invalid email or password.");
  }

  const passwordMatches = await bcrypt.compare(
    input.password,
    user.password_hash,
  );

  if (!passwordMatches) {
    throw new Error("Invalid email or password.");
  }

  const tokenOptions: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as NonNullable<SignOptions["expiresIn"]>,
  };

  const token = jwt.sign(
    { sub: user.id },
    env.JWT_SECRET,
    tokenOptions,
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
    },
  };
}
