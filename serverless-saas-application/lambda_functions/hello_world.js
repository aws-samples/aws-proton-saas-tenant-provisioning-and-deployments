exports.handler = async (event, context) => {
    return {
      statusCode: 200,
        headers: {},
        body: "Hello again! - " + process.env.TENANT_ID
    }  
};
