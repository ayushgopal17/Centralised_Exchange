const BASE_URL = "http://localhost:3000";

async function signup(username: string, password: string) {
    const res = await fetch(`${BASE_URL}/signup`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            username,
            password,
        }),
    });

    const data = await res.json();

    console.log("\n==========================");
    console.log("SIGNUP");
    console.log(username);
    console.log(data);

    return data;
}

async function signin(username: string, password: string) {
    const res = await fetch(`${BASE_URL}/signin`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            username,
            password,
        }),
    });

    const data = await res.json();

    console.log("\n==========================");
    console.log("SIGNIN");
    console.log(username);
    console.log(data);

    return data.token;
}

async function createOrder(token: string, order: any) {
    const res = await fetch(`${BASE_URL}/order`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            token,
        },
        body: JSON.stringify(order),
    });

    const data = await res.json();

    console.log("\n==========================");
    console.log("CREATE ORDER");
    console.log(order);
    console.log(data);

    return data;
}

async function getOrders(token: string) {
    const res = await fetch(`${BASE_URL}/order`, {
        method: "GET",
        headers: {
            token,
        },
    });

    const data = await res.json();

    console.log("\n==========================");
    console.log("GET ORDERS");
    console.log(JSON.stringify(data, null, 2));

    return data;
}

async function run() {
    const buyerName = "buyer" + Date.now();
    const sellerName = "seller" + Date.now();

    const password = "123456";

    console.log("\n==========================");
    console.log("STARTING TESTS");
    console.log("==========================");

    //------------------------------------
    // Signup
    //------------------------------------

    await signup(buyerName, password);
    await signup(sellerName, password);

    //------------------------------------
    // Signin
    //------------------------------------

    const buyerToken = await signin(buyerName, password);
    const sellerToken = await signin(sellerName, password);

    //------------------------------------
    // Buy Order
    //------------------------------------

    await createOrder(buyerToken, {
        market: "sol",
        price: 100,
        qty: 2,
        side: "buy",
        type: "LIMIT",
    });

    //------------------------------------
    // Sell Order
    //------------------------------------

    await createOrder(sellerToken, {
        market: "sol",
        price: 95,
        qty: 2,
        side: "sell",
        type: "LIMIT",
    });

    //------------------------------------
    // Get Orders
    //------------------------------------

    await getOrders(buyerToken);

    await getOrders(sellerToken);

    console.log("\n==========================");
    console.log("TEST FINISHED");
    console.log("==========================");
}

run();