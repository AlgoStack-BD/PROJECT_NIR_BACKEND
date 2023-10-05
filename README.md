# Nir


## Registration Format { Endpoint -> /register }
```
{
    "data": {
        "name": "Shrabon",
        "email": "shrabon@gmail.com",
        "password": "123456",
        "phone": null,
        "isVerified": false,
        "image": [],
        "location": "Sylhet, Bangladesh",
        "totoalPost": 0,
        "rentSuccess": 0,
        "isAdmin": true
    }
}
```
## Login Format { Endpoint -> /login }
```
{
    "email": "shrabon06065@gmail.com",
    "password": "1233456"
}

```

## Reset Password Format { Endpoint -> /login }
```
{
    "data":{
        "email" : "saif06065@gmail.com",
        "password": "8585"
    }
}

```
## Singel User Format { Endpoint -> /reset-password }
```
1. Header -> Authorization

```

## All User Format { Endpoint -> /all-users }
```
1. Header -> Authorization

```
## Creat Post Format { Endpoint -> /create-post }
```
{
    "data": {
        "userId": "64c94684626f615553c97ae0",
        // required
        "location": "sdfhjs house",
        "type": "family",
        "isNegotiable": false,
        "bedRoom": 2,
        "bathRoom": 2,
        "kitchen": 1,
        // optional
        "drawingRoom": 1,
        "diningRoom": 1,
        "balcony": 1,
        // This will be taken from side of owner
        "bills": {
            // required
            "gasBill": true,
            "electricBill": false,
            "waterBill": false,
            // optional
            "otherBills": "Nai"
        },
        // max 5 ta by cheking array lenght | required
        "img": [
            "image link 1",
            "image link 2"
        ],
        // required
        "price": 10000,
        // optional
        "additionalMessage": "Nai",
        // required
        "likeCount": 112,
        "isPublicNumber": true,
        "isSold": false,
        "isApproved": false,
        "isAdminPost": false
    }
}

```
## Verification Code { Endpoint -> /getVerificationCode }
{
    1. Headers -> Authorization
}

## Verify OTP { Endpoint -> /verifyOTP }
```
{
    "email": "saif06065@gmail.com",
    "userOTP": "2235"
}

```
## Get All Post Format { Endpoint -> /getAllNotePost }
```
 N/A
 
```
## USER DATA Post format

```
{
    "data": {
            "name": "Test",
            "email": "test@test.com",
            "password": "123456",
            "phone": "01778287079",
            "isVerified": true,
            "image": "",
            "location": "Sylhet, Bangladesh",
            "totalPost": 2,
            "rentSuccess": 2,
            "isAdmin": false,
            “lookingFor”: “Family, Hostel”,
            “accountType”: “Free / Premium”,
            “subscriptionStatus” : true,
            “subscriptionId”: “123”, 
            “expiresIn”: “if premium (dd-mm–yy)”
            “bkash”: “01778287079”,
            “nagad”: “01778287079”
            “rocket”: “01778287079”

    }
}

```