let accessToken, roots, selectedAssetID, selectedDEID, selectedAsset, selectedDE;

$('document').ready(function() {
    var sdk = new window.sfdc.BlockSDK();
    const toastTemplate = $('#toastTemplate').html();

    // types ["info","success","warning","error"]
    function showToast(type, message, description) {
        let options = {"type":type,"message":message,"description":description};
        $("#spinner").fadeOut(200);
        var render = Handlebars.compile(toastTemplate);
        $("#toast-container").html(render(options));
        $("#toast-container").fadeIn(200);
    }

    $(document).on("click", ".close-toast", function(e) {
        $("#toast-container").hide();
    });

    $(document).on("click", ".select", function(e) {
        let dataType = ($(e.target).hasClass('data-extension')) ? 'dataextension' : 'asset';
        showSelect(dataType);
    });

    $(document).on("click", ".close-select", function(e) {
        closeSelect();
    });

    $(document).on("click", "#btn-tree-save", async function(e) {
        let selectorType = $("#asset-selector").attr("selector-type");
        let selectedId = $('#asset-selector').tree('selectedItems');

        console.log("selectedId",selectedId);


        /*
        setCookie('sfmc_' + selectorType,selectedAssetID,365);


        if(selectedAssetID){
            selectedAsset = await getAssetDef(selectorType, selectedAssetID)
        }
        console.log("selectedAsset",selectedAsset);
        */
        closeSelect();
    });

    function getAssetDef(selectorType,id){
        return 'foo';
    }

    function closeSelect(){
        $('#modal-backdrop').hide();
        $('#tree-container').hide();
    };

    $(document).on("selected.fu.tree", function(event, data) {
        let selectorType = $("#asset-selector").attr("selector-type");

        if(data.target){
            $('#btn-tree-save').prop('disabled', false);
            if (selectorType == 'asset'){
                selectedAssetID = data.target.id;
                setCookie('sfmc_selectedAssetID',selectedAssetID,365);
                console.log("selectedAssetID",selectedAssetID);
            } else if (selectorType == 'dataextension'){
                selectedDEID = data.target.id;
                setCookie('sfmc_selectedDEID',selectedDEID,365);
                console.log("selectedDEID",selectedDEID);
            }
        }
    });

    $(document).on("deselected.fu.tree", function(event, data) {
        $('#btn-tree-save').prop('disabled', true);
        let selectorType = $(event.target).attr("selector-type");

        if(data.target){
            if (selectorType == 'asset'){
                selectedAssetID = null;
                console.log("selectedAssetID",selectedAssetID);
            } else if (selectorType == 'dataextension'){
                selectedDEID = null;
                console.log("selectedDEID",selectedDEID);
            }

        }
    });



    function showBackdrop(darkLight){
        if (darkLight == 'dark'){
            $('#modal-backdrop').removeClass('backdrop-light');
            $('#modal-backdrop').addClass('backdrop-dark');
        } else {
            $('#modal-backdrop').removeClass('backdrop-dark');
            $('#modal-backdrop').addClass('backdrop-light');
        }
        $('#modal-backdrop').show();
    }


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
        //document.getElementById('crm-id-field').value = crmIdField;
    }

    function showMessage(type){
        if (type === 'error'){
            sdk.setSuperContent('<div style="font-family: Helvetica, Sans-Serif; font-size: 20px; line-height: 50px; text-align: center; height: 50px; text-align: center; background-color: red; color:white; min-width:100%;">Log to Sales Cloud - Please Configure</div>');
        } else {
            sdk.setSuperContent('<div style="font-family: Helvetica, Sans-Serif; font-size: 20px; line-height: 50px; text-align: center; height: 50px; text-align: center; background-color: green; color:white; min-width:100%;">Log to Sales Cloud - Configured</div>');
        }
    }

    function updateMe() {
        //chkContact = $("#chkContact").prop('checked');
        //chkOpportunity = $("#chkOpportunity").prop('checked');
        //crmIdField = $('#crm-id-field').val();

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

    showSelect = async function (selectorType){
        // Clear down the form
        // To do
        var treeTemplate = $('#treeTemplate').html();
        var render = Handlebars.compile(treeTemplate);

        let options = {
            "selectorType":selectorType,
            "title": (selectorType == 'dataextension') ? 'Data Extension' : 'Asset'
        };

        $("#tree-container").html(render(options));

        $('#asset-selector').tree({
          dataSource: getTreeData,
          multiSelect: false,
          folderSelect: false,
          contenttype: selectorType
      });

        showBackdrop('dark');
        $('#tree-container').show();
    }

    getTreeData = function (openedParentData, callback) {
        let childNodesArray = [];
        let selectorType = $('#asset-selector').attr('selector-type');

        if (!openedParentData.id){
            // Initialization of tree. Load relevant roots.
            let types = {
                "asset":['asset','asset-shared'],
                "dataextension":['dataextension','salesforcedataextension']
            }

            let typesToShow = types[selectorType];

            for (var r=0;r<roots.length;r++) {
                if(typesToShow.indexOf(roots[r].ContentType) !== -1){
                    childNodesArray.push(
                        {
                            "name":roots[r].Name,
                            "type":roots[r].Type,
                            "id":roots[r].Id,
                            "contenttype":roots[r].ContentType
                        }
                    );
                }
            }
            callback({data: childNodesArray});
        } else {
            var endpoint = window.location.protocol + "//" + window.location.hostname + ":" + window.location.port + "/folders/" + selectorType + "/" + openedParentData.id;

            $.ajax({
                type: "GET",
                url: endpoint,
                success: function(resp) {
                    console.log(resp);
                    for (var r=0;r<resp.length;r++) {
                        childNodesArray.push(
                            {
                                "name":resp[r].Name,
                                "type":resp[r].Type,
                                "id":resp[r].Id,
                                "contenttype":resp[r].ContentType
                            }
                        );
                    }
                    callback({data: childNodesArray});
                },
                error: function(resp) {
                    console.log(resp);
                    callback({data: childNodesArray});
                }
            });
        }

    }
});

function onRender() {
    roots = JSON.parse(decodeURI(getCookie('sfmc_roots')))

    //if (!roots){
        let promise = Promise.all([$.getRoots()]);

        promise.then(function(data) {
            roots = data[0];
            console.log('Roots',roots);
            $('#workspace').show();
            $('#spinner').hide();
            $('#modal-backdrop').hide();
        }).catch(function(error) {
            console.log('Error',error);
        });
    //} else {
    //    console.log('Roots','Cached');
    //}
}

$.getRoots = function(){
    var endpoint = window.location.protocol + "//" + window.location.hostname + ":" + window.location.port + "/folders/all/0";

    return new Promise(function(resolve, reject) {
        $.ajax({
            type: "GET",
            url: endpoint,
            success: function(resp) {
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
