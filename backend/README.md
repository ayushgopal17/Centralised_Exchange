# backend
# CEX V1 💹

A backend implementation of a simplified Centralized Cryptocurrency Exchange built to understand how modern exchanges process orders, manage balances and execute trades.

> This project focuses entirely on backend architecture and exchange fundamentals.

---
                          +----------------+
                          |     Client     |
                          +-------+--------+
                                  |
                           HTTP Requests
                                  |
                                  v
                       +---------------------+
                       |    Express Server   |
                       +----------+----------+
                                  |
                 +----------------+----------------+
                 |                                 |
                 v                                 v
       +-------------------+             +-------------------+
       | Authentication    |             |   Order Routes    |
       | (JWT, Middleware) |             | Place / Cancel    |
       +---------+---------+             +---------+---------+
                 |                                 |
                 +----------------+----------------+
                                  |
                                  v
                       +---------------------+
                       |  Matching Engine    |
                       | (Price-Time Match)  |
                       +----------+----------+
                                  |
              +-------------------+-------------------+
              |                                       |
              v                                       v
     +---------------------+               +----------------------+
     |  In-Memory          |               |     Prisma ORM       |
     |  Order Book         |               +----------+-----------+
     | (Bids / Asks)       |                          |
     +----------+----------+                          |
                |                                     |
                +-------------------+-----------------+
                                    |
                                    v
                           +----------------------+
                           |     PostgreSQL       |
                           | Users / Orders /     |
                           | Fills / Stocks       |
                           +----------------------+

## Features

### Authentication

- User Signup
- User Login
- JWT Authentication
- Protected Routes

### Order Management

- Place Buy Orders
- Place Sell Orders
- Cancel Orders
- View Order History

### Matching Engine

- Price-Time Priority Matching
- Partial Order Matching
- Full Order Matching
- Automatic Trade Execution

### Balance Management

- Available Balance
- Locked Balance
- Asset Settlement
- Balance Updates after Trades

### Trade History

- Fill Creation
- User Fill History
- Order Status Updates

---

## Tech Stack

- Node.js
- Express.js
- TypeScript
- PostgreSQL
- Prisma ORM
- JWT
- bcrypt
- Zod

---

## Backend Highlights

- RESTful API Design
- In-Memory Order Book
- Custom Matching Engine
- JWT Authentication
- Request Validation
- Relational Database Design
- Modular Project Structure
- Error Handling

---

## Folder Structure

```text
src/
├── controllers
├── routes
├── middleware
├── engine
├── prisma
├── utils
├── types
└── index.ts
```

---

## Project Status

✅ Backend Completed

---

## Author

**Ayush Gopal**


## APIs

### Authentication
- POST /signup
- POST /signin

### Orders
- POST /order
- GET /order
- GET /order/:id
- DELETE /order/:id

### Fills
- GET /fills

### Balance
- GET /balance
- GET /balance/usd

### Market
- GET /depth/:symbol



To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.3.14. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
