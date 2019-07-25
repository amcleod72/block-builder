let accessToken, roots;

function onRender() {
    console.log('Cookie',getCookie('sfmc_roots'));
    roots = JSON.parse(decodeURI(getCookie('sfmc_roots')))

    if (!roots){
        let promise = Promise.all([$.getRoots()]);

        promise.then(function(data) {
            console.log('Roots','Refreshed');
        }).catch(function(error) {
            console.log('Error',error);
        });
    } else {
        console.log('Roots','Cached');
    }
}

$.getRoots = function(){
    var endpoint = window.location.protocol + "//" + window.location.hostname + ":" + window.location.port + "/folders/0";

    return new Promise(function(resolve, reject) {
        $.ajax({
            type: "GET",
            url: endpoint,
            success: function(resp) {
                console.log("Roots",resp)
                setCookie('sfmc_roots',JSON.stringify(resp),365);
                resolve(resp);
            },
            error: function(response) {
                reject(response);
            }
        });
    });
}

function setCookie(cookieName, cookieValue, nDays) {
     var today = new Date();
     var expire = new Date();
     if (nDays == null || nDays == 0) nDays = 1;
     expire.setTime(today.getTime() + 3600000 * 24 * nDays);
     document.cookie = cookieName + "=" + encodeURI(cookieValue) + "; expires=" +
     expire.toGMTString() + "; path=/";
}

function getCookie(cookiename) {
    var value = "; " + document.cookie;
    var parts = value.split("; " + cookiename + "=");
    if (parts.length == 2) {
        return parts.pop().split(";").shift();
    } else {
        return null;
    }
}

$('document').ready(function() {
    var sdk = new window.sfdc.BlockSDK();
    var crmIdField,chkContact,chkOpportunity;

    let modelAmp = `<!--%%[
    IF _messagecontext == 'SEND' AND IndexOf(list_,'_HTML') > 1 THEN
        /* Define the field to use to associate the send with a CRM object */
        SET @WhatId = AttributeValue('%%WhatId%%')
        /* Scrape VAWP to get HTML for DE Log */
        SET @HTMLContent = HttpGet(view_email_url)

        IF LENGTH(@HTMLContent) > 32000 THEN
            SET @header = Concat('<span align="center"><h1><a href="',view_email_url,'" target="_blank">View Entire Message Online</a></h1></span>')
            SET @HTMLContent = Concat(@header,Substring(@HTMLContent,1,31000))
        ENDIF

        /* Update Salesforce CRM */
        SET @SFEmailID = CreateSalesforceObject("EmailMessage",8,"HTMLBODY",@HTMLContent, "SUBJECT",emailname_,"FROMNAME",replyname,"FROMADDRESS",replyemailaddress,"TOADDRESS",emailaddr,"INCOMING",0,"STATUS",3,"RELATEDTOID",@WhatId)
        SET @RelationID = CreateSalesforceObject("EmailMessageRelation",4,"EmailMessageId",@SFEmailID,"RelationAddress",emailaddr,"RelationId",_subscriberkey,"RelationType","ToAddress")
    ENDIF
    ]%%-->`;

    sdk.getData(function(data) {
        crmIdField = data.crmIdField;
        chkContact = data.chkContact;
        chkOpportunity = data.chkOpportunity;

        if(!chkContact){
            showMessage('error');
        }
        fillSettings();
    });

    sdk.triggerAuth('8d023663-4221-4b41-b849-68bedb9b2be3');

    $('#chkContact').change(function() {
        $("#opportunityToggleContainer").toggle();
    });

    $('#chkOpportunity').change(function() {
        $(".idContainer").toggle();
    });


    function debounce(func, wait, immediate) {
        var timeout;
        return function() {
            var context = this,
                args = arguments;
            var later = function() {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            var callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    }

    function fillSettings() {
        document.getElementById('crm-id-field').value = crmIdField;
    }

    function showMessage(type){
        if (type === 'error'){
            sdk.setSuperContent('<div style="font-family: Helvetica, Sans-Serif; font-size: 20px; line-height: 50px; text-align: center; height: 50px; text-align: center; background-color: red; color:white; min-width:100%;">Log to Sales Cloud - Please Configure</div>');
        } else {
            sdk.setSuperContent('<div style="font-family: Helvetica, Sans-Serif; font-size: 20px; line-height: 50px; text-align: center; height: 50px; text-align: center; background-color: green; color:white; min-width:100%;">Log to Sales Cloud - Configured</div>');
        }
    }

    function updateMe() {
        chkContact = $("#chkContact").prop('checked');
        chkOpportunity = $("#chkOpportunity").prop('checked');
        crmIdField = $('#crm-id-field').val();

        if(!chkContact){
            sdk.setContent("");
            showMessage('error');
            return;
        }

        if(chkOpportunity && !crmIdField){
            sdk.setContent("");
            showMessage('error');
            return;
        }

        // Generate required AMPScript
        var amp = modelAmp.replace(/%%WhatId%%/img,chkOpportunity ? crmIdField : 'foo');
        sdk.setContent(amp);
        showMessage('success');
        sdk.setData({
            crmIdField: crmIdField
        });
    }

    document.getElementById('workspace').addEventListener("input", function() {
        debounce(updateMe, 500)();
    });
});
