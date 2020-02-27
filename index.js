var AWS = require('aws-sdk');
var s3 = new AWS.S3();
var pinpoint = new AWS.Pinpoint({region: 'us-west-2'});

var applicationId = process.env.PINPOINT_PROJECT_ID;
var bucket = process.env.CONTACTS_BUCKET;
var email = process.env.EMAIL;
var phone = process.env.PHONE;
var originationNumber = process.env.ORIGINATION_NUMBER;


exports.handler = function(event, context, callback) { 
    console.log("Event: " + JSON.stringify(event, 4));
    

    //For testing purposes, the Lambda console can take the format {Id:''}
    //For example, if there exists a record: contacts/web/671ff104182e4ee7b93479bef235b8f5
    //You can test this contact by invoking the Lambda with {"Id":"671ff104182e4ee7b93479bef235b8f5"}  
    var s3params = {
        Bucket: "idkpopup-website", 
        Key: "contacts/web/" + event.Id
    };    
    if (event.Id === undefined) {
        s3params.Key = event.Records[0].s3.object.key;
    }

    function S4() {
        return (((1+Math.random())*0x10000)|0).toString(16).substring(1); 
    }
     
    function createGUID() {
        return (S4() + S4() + "-" + S4() + "-4" + S4().substr(0,3) + "-" + S4() + "-" + S4() + S4() + S4()).toLowerCase();
    }
    //console.log(JSON.stringify('Environment: ' + process.env));
    console.log('s3Parms:' + JSON.stringify(s3params));
    s3.getObject(s3params, function(err, data) {
         if (err) {
            console.log("S3 get error" + err, err.stack);
            //log to cloudwatch
         }
         else {
             
             var endpoint = JSON.parse(data.Body.toString('utf-8'));
             console.log(JSON.stringify(endpoint));
             var currentDate = new Date();
             var isoEffectiveDate = currentDate.toISOString();

             var date = currentDate.getDate();
             if (date < 10) {
                 date = "0" + date;
             }
             var month = currentDate.getMonth() + 1;
             if (month < 10) {
                 month = "0" + month;
             }
             var year = currentDate.getFullYear();
             var effectiveDate = year + "" + month + "" + date;

             var params = {
                ApplicationId: applicationId,
                EndpointId: endpoint.Id,
                EndpointRequest: {
                    Demographic: {
                        AppVersion: 'Web-1.0',
                        Locale: 'NA',
                        Make: 'NA',
                        Model: 'NA',
                        ModelVersion: 'NA',
                        Platform: 'Web',
                        PlatformVersion: '1.0',
                    },
                    EffectiveDate: isoEffectiveDate,
                    Attributes: {
                        'Source': ['WEBSITE'],
                        'EffectiveDate': ['effectiveDate']
                    },
                    EndpointStatus: endpoint.MailingList == "true" ? "ACTIVE" : "INACTIVE",
                    Location: {
                        City: endpoint.City,
                        Country: endpoint.Counter,
                        Latitude: endpoint.Latitude,
                        Longitude: endpoint.Longitude,
                        PostalCode: endpoint.PostalCode,
                        Region: endpoint.Region
                    }
                }
             };
             
             if (endpoint.MailingList === "false") {
                 params.EndpointRequest.OptOut = "ALL"
             } else {
                params.EndpointRequest.OptOut = "NONE"
             }
             
             //If the contact has both an email address and phone number, create two endoints in Pinpoint
            var addedEndpoint = false;
            
            //Register email endpoint
            if (endpoint.Email != undefined && endpoint.Email != "undefined") {
                console.log('Saving Email Endpoint');
                params.EndpointRequest.Address = endpoint.Email;
                params.EndpointRequest.ChannelType = "EMAIL";
                params.EndpointId = endpoint.Id,

                pinpoint.updateEndpoint(params, function(err, data) {
                    if (err) console.log(err, err.stack); // an error occurred
                    else     console.log("EMAIL endpoint created: " + JSON.stringify(data)); {
                        addedEndpoint = true;
                    }
                });
            } 
            
            //Register phone endpoint
            if (endpoint.Phone != undefined && endpoint.Phone != "undefined") {
                console.log('Saving SMS Endpoint');
                params.EndpointRequest.Address = endpoint.Phone;
                params.EndpointRequest.ChannelType = "SMS";
                params.EndpointId = createGUID(),

                pinpoint.updateEndpoint(params, function(err, data) {
                    if (err) console.log(err, err.stack); // an error occurred
                    else     console.log("SMS endpoint created: " + JSON.stringify(data)); {
                        addedEndpoint = true
                    }
                }); 
                }
            }

            // Specify the parameters to pass to the API.
            var emailParams = {
                ApplicationId: applicationId,
                MessageRequest: {
                    Addresses: {},
                    MessageConfiguration: {
                        EmailMessage: {
                        FromAddress: email,
                        SimpleEmail: {
                            Subject: {
                                Charset: "UTF-8",
                                Data: "New Contact: " + endpoint.FirstName + " " + endpoint.LastName
                            },
                            HtmlPart: {
                                Charset: "UTF-8",
                                Data: JSON.stringify(endpoint, null, 1)
                            },
                            TextPart: {
                                Charset: "UTF-8",
                                Data: JSON.stringify(endpoint, null, 1)
                            }
                        }
                        }
                    }
                }
            };

            //
            emailParams.MessageRequest.Addresses[email] = {ChannelType: 'EMAIL'};
            console.log("Email Params: " + JSON.stringify(emailParams));

            pinpoint.sendMessages(emailParams, function(err, data) {
                if(err) { console.log(err, err.message); } 
                else {
                  console.log("Email sent: " + JSON.stringify(data, null, 1));
                }
              });

              
            //send SMS
            var smsParams = {
                ApplicationId: applicationId,
                MessageRequest: {
                    Addresses: {},
                    MessageConfiguration: {
                        SMSMessage: {
                            Body: "New Contact: " + endpoint.FirstName + " " + endpoint.LastName,
                            Keyword: 'keyword_176275134597',
                            MessageType: 'TRANSACTIONAL',
                            OriginationNumber: originationNumber,
                            SenderId: 'idkpopup',
                        }
                    }
                }
            };

            smsParams.MessageRequest.Addresses[phone] = {ChannelType: 'SMS'};
            console.log("SMS Params: " + JSON.stringify(smsParams));    
            
            pinpoint.sendMessages(smsParams, function(err, data) {
                // If something goes wrong, print an error message.
                if(err) {
                  console.log(err.message);
                } else {
                  console.log("SMS sent: " + JSON.stringify(data, null, 1));
                }
              });

            const response = {
                statusCode: 200,
                body: JSON.stringify(endpoint),
            };
            return response;
       });
};

