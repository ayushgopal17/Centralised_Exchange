import express from "express"

import prisma from "./db";
import jwt from "jsonwebtoken"
import { authMiddleware } from "./middleware";
import { matchOrder } from "./engine";

const app=express();
app.use(express.json());

 export const BALANCES:any = {};


export const ORDER_BOOK: any={
sol:{
    bids:[],
     ask:[]
},
btc: {
    bids:[],
    ask:[]
}
}

app.post("/signup",async(req,res)=>{
const username=req.body.username;
const password=req.body.password;

const userExist= await  prisma.user.findUnique({
where: {
   username
   }
});

if(userExist){
    return res.status(403).json({
    message: "user with this username already exist"
    })
}
const user= await prisma.user.create({
    data: {
        username: username,
        password: password
    }
})
BALANCES[user.id] = {
    usd: {
        available: 10000,
        locked: 0
    },
    sol: {
        available: 10,
        locked: 0
    }
};
 return res.status(200).json({
   message:  "Signined up successfully"
})
})

app.post("/signin",async(req,res)=>{
const username=req.body.username;
const password=req.body.password;

//fetch by username and compare using bcrypt in V2
const userExist= await prisma.user.findUnique({
    where: {
        username,
        password
    }
})
if(!userExist){
return res.status(403).json({
    message : "Wrong credientials"
})

}

const token= jwt.sign({
    id: userExist.id
},"Secret123")

 return res.status(201).json({
    token
})
})

app.post("/order",authMiddleware,async(req:any,res)=>{
const userId=req.userId;
const {market,price,qty,side,type} = req.body;

const balance=BALANCES[userId];
if (!balance) {
    return res.status(404).json({
        message: "Balance not found"
    });
}

if(side == "buy"){
const total=price*qty;
if(balance.usd.available >=total){
balance.usd.available -= total;
balance.usd.locked += total;
   const order= await prisma.order.create({
    data:{
        userId,
        market,
        price,
        qty,
        side,
        type,
        filledQty: 0,
        status: "OPEN"
    }
    
})
await matchOrder(order)

return res.status(201).json({
    message: "order created successfully"
})


}
else{


 return res.status(403).json({
    message: "Insuficient balance"
})
}

}
else if(side=="sell"){
    if(balance.sol.available >=qty){
        balance.sol.available -= qty;
        balance.sol.locked +=qty;


     const order=   await prisma.order.create({
            data:{
                userId,
                market,
                price,
                qty,
                side,
                type,
                filledQty: 0,
                status: "OPEN"
            }
        });
        await matchOrder(
            order
        );
       return res.status(201).json({
            message: "order created successfully"
        })
    }
    else{
        return res.status(403).json({
            message: "Insufficient asset"
        })
    }
}    

}) 


app.get("/order/:orderId",authMiddleware,async(req:any,res)=>{

 const userId=req.userId;
 const {orderId}= req.params;

 const order= await prisma.order.findUnique({
    where:{
        orderId
    }
 })
 if(!order)
{
    return res.status(404).json({
        message: "order not found"
    })
}

if(order.userId ===userId){


return res.status(200).json({
    order
})
}
res.status(403).json({
    message: "you are not the owner"
})

})

app.delete("/order/:orderId",authMiddleware,async(req:any,res)=>{

    const userId=req.userId;
   const {orderId}=req.params;
    const order= await prisma.order.findUnique({
     where:{
       id: orderId
     }
    })
    if(!order){
        return res.status(404).json({
            message: "order not found"
        })
    }
    if(order.userId== userId){
        const balance = BALANCES[userId];

if (order.side === "buy") {
    const total = order.price * order.qty;

    balance.usd.available += total;
    balance.usd.locked -= total;
} else if (order.side === "sell") {
    balance.sol.available += order.qty;
    balance.sol.locked -= order.qty;
}
       const Delete=await  prisma.order.delete({
       
    where:{
orderId
    } 
       })
       return res.status(200).json({
        message: "order deleted successfully"
       })
    }
   return res.status(403).json({
message :"wrong userId"
    })

})

app.get("/depth/:symbol",(req,res)=>{

    const { symbol }= req.params ;
    const depth=ORDER_BOOK[symbol];
  
    if(!depth){
        return res.status(404).json({
            message: "Market not found"
        })
    }
    return res.json({
        depth
    })
})

app.get("/order",authMiddleware, async(req:any,res)=>{
   const userId=req.userId;

 const order= await prisma.order.findMany({
    where:{
        userId
    }
 });

 return res.status(200).json({
    order
 })

})


app.get("/fills",authMiddleware,async(req:any,res)=>{
   const userId=req.userId;

   const fill= await prisma.fill.findMany({
    where:{
        userId
    }
   })
   return res.status(200).json({
    fill
   })

})
app.get("/balance/usd",authMiddleware,(req:any,res)=>{

    const userId=req.userId;
    const balance=BALANCES[userId];
    if(balance){
      return  res.status(200).json({
     usd:balance.usd
        })
    }
   return res.status(404).json({
        message: "balance not exist"
    })
})
app.get("/balance",authMiddleware,(req:any,res)=>{
   const userId= req.userId;
   const balance=BALANCES[userId];
   if(balance){
  return  res.status(200).json({
        balance
    })
   }
   return res.status(404).json({
        message: "balance not exist"
    })
})

app.listen(3000)