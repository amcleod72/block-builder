$.aljsInit({assetsLocation: '.'});

$('document').ready(function() {
    // Grab HTML needed for Toast messages
    const toastTemplate = $('#toastTemplate').html();
    const campaignHeaderColTemplate = $('#campaignHeaderColTemplate').html();
    let schema;
    let campaigns,selectedCampaign;

    onRender();

    // types ["info","success","warning","error"]
    function showToast(type, message, description) {
        let options = {"type":type,"message":message,"description":description};
        $("#spinner").fadeOut(200);
        var render = Handlebars.compile(toastTemplate);
        $("#toast-container").html(render(options));
        $("#toast-container").fadeIn(200);
    }

    function hideToast() {
        $("#toast-container").empty();
    }

    $(document).on("click", ".close-toast", function(e) {
        $("#toast-container").hide();
    });

    function onRender() {
        let promise = Promise.all([getCampaigns(),getSchema()]);
        //let promise = Promise.all([getSchema()]);
        promise.then(function(data) {
            sortSchema();
            fillTable();
        }).catch(function(error) {
            showToast('error', 'Error', "Unable to retrieve campaign and configuration data from Salesforce Marketing Cloud." + JSON.stringify(error));
        });
    }

    function showAddJourney(target){
        let cards = $(target).find('.journey');
        if (cards.length === 0){
            $(target).find('.journey-add-button').show();
        } else {
            $(target).find('.journey-add-button').hide();
        }
    }

    function getSchema(){
        // Build url and request to the proxy service
        var endpoint = window.location.protocol + "//" + window.location.hostname + ":" + window.location.port + "/rest/schema";

        return new Promise(function(resolve, reject) {
            $.ajax({
                type: "GET",
                url: endpoint,
                success: function(resp) {
                    schema = resp
                    resolve(schema);
                },
                error: function(response) {
                    reject(response);
                }
            });
        });
    }

    function getCampaigns(){
        // Build url and request to the proxy service
        var endpoint = window.location.protocol + "//" + window.location.hostname + ":" + window.location.port + "/rest/campaigns";

        return new Promise(function(resolve, reject) {
            $.ajax({
                type: "GET",
                url: endpoint,
                success: function(resp) {
                    campaigns = resp;
                    //console.log("Campaigns",campaigns)
                    resolve(campaigns);
                },
                error: function(response) {
                    reject(response);
                }
            });
        });
    }

    function fillTable(){
        if (schema && schema.Fields){
            let headRender = Handlebars.compile(campaignHeaderColTemplate);
            let formRender, template;
            let rowTemplate = $('#campaignRowTemplate').html();
            let rowRender = Handlebars.compile(rowTemplate);
            let fieldsRendered = [];

            for (i = 0; i < schema.Fields.length; i++) {

                let field = schema.Fields[i];
                //console.log(field.Name);
                //console.log(schema.Fields[i]);
                if (field.Position !== undefined || field.Hidden){

                    if (!field.Hidden){
                        $("#campaign-header-row").append(headRender(field));
                    }

                    if (field.FieldType.toLowerCase() === 'text' || field.FieldType.toLowerCase() === 'number'){
                        if (field.Allowedvalues){
                            template = $('#inputSelectTemplate').html();
                        } else {
                            if (!field.MaxLength || field.MaxLength > 500){
                                template = $('#inputTextAreaTemplate').html();
                            } else {
                                template = $('#inputTextTemplate').html();
                            }
                        }
                    } else if (field.FieldType.toLowerCase() === 'date'){
                        template = $('#inputDateTemplate').html();
                    } else if (field.FieldType.toLowerCase() === 'boolean'){
                        template = $('#inputCheckTemplate').html();
                    } else {
                        template = undefined;
                    }

                    if (template){
                        fieldsRendered.push(field);
                        formRender = Handlebars.compile(template);
                        $("#form-field-container").append(formRender(field));
                    }
                }
            }

            for (c = 0; c < campaigns.length; c++) {
                let campaign = campaigns[c];
                let rowHtml = '';
                let cellTemplate = $('#campaignRowCellTemplate').html();
                let cellRender = Handlebars.compile(cellTemplate);

                for (fr = 0; fr < fieldsRendered.length; fr++) {
                    field = fieldsRendered[fr];
                    let val;
                    if(field.Allowedvalues){
                        for (av = 0; av < field.Allowedvalues.length; av++) {
                            if(field.Allowedvalues[av][campaign[field.Name]]){
                                val = field.Allowedvalues[av][campaign[field.Name]];
                            }
                        }
                    } else {
                        val = campaign[field.Name];
                    }

                    if (field.Name == 'owner'){
                        val = getUser(val).name;
                    }

                    if(fr === 0){
                        $("#campaign-list tbody").append(rowRender({'id':campaign.id,'val':val}));
                    } else {
                        if (!field.Hidden){
                            rowHtml += cellRender({'id':campaign.id,'val':val});
                        }
                    }
                }
                $("#row-name-" + campaign.id).after(rowHtml);
            }

            // Add Action button to the end of each record in the Data List
            $("#campaign-header-row").append('<th class="" scope="col" style="width: 3.25rem;"><div class="slds-truncate slds-assistive-text" title="Actions">Actions</div></th>');

            // Initialise DateTime Pickers
            $('.date-input').datepicker({
                numYearsBefore: 2,
                numYearsAfter: 2,
                format: 'DD/MM/YYYY',
                initDate: moment(),
                onChange: function(datepicker) {
                    //console.log('changed', datepicker);
                },
                onShow: function(datepicker) {
                    //console.log('shown', datepicker);
                },
                onDismiss: function(datepicker) {
                    //console.log('dismissed', datepicker);
                },
                onSelect: function(datepicker, selectedDate) {
                    //console.log('selected', datepicker, selectedDate);
                }
            });

            // Create environment tiles in modal
            let envTemplate = $('#envContainerTemplate').html();
            let envRender = Handlebars.compile(envTemplate);

            for (var env in schema.Environments) {
                $("#env-container").append(envRender(schema.Environments[env]));
            }
        }
        $('#spinner').hide();
    }

    function setDragZones(els){
        dragula(els,{
            copy: function (el, source) {
                return true;
            },
            moves: function (el, source, handle, sibling) {
                return $(el).hasClass("journey") ? true : false;
            },
            accepts: function (el, target) {
                let isJourney = $(el).hasClass("journey") ? true : false;
                let cards = $(target).find('.journey');
                for (i = 0; i < cards.length; i++) {
                    if (!$(cards[i]).hasClass("moving")){
                        $(cards[i]).hide();
                    }
                }
                return isJourney;
            }
        }).on('drag', function (el) {
            $(".journey").removeClass("moving");
            $(el).addClass("moving");
        }).on('drop', function (el,target) {
            copyVersion(el,target);
        }).on('over', function (el, target) {
            let cards = $(target).find('.journey');
            for (i = 0; i < cards.length; i++) {
                if (!$(cards[i]).hasClass("moving")){
                    $(cards[i]).hide();
                }
            }
        }).on('cancel', function (el) {
            $(".journey").removeClass("moving");
        }).on('out', function (el, target) {
            $(".journey").show();
        });
    }

    async function copyVersion(el,target){
        console.log("dropped");
        console.log("Element",el);
        console.log("Target",target);
        $(target).find('.journey').remove();
        $(target).append($(el));
        $(".journey").show();
        $(".journey").removeClass("moving");
        $(target).find('.journey-add-button').hide();

        // Get the exxisting journey for this environment
        let targetEnv = $(target).attr("environment");

        if (!targetEnv){
            return;
        }

        let fromId = $(el).attr("id");
        let fromVersionId = $(el).find(".version-card").attr("id");
        let fromVersionNumber = $(el).find(".version-card").attr("versionnumber");
        let toId,fromJourney;


        for (i = 0; i < selectedCampaign.journeys.length; i++) {
            console.log("Source Environment",selectedCampaign.journeys[i].environment);
            console.log("Target Environment",targetEnv);
            console.log("Journey i",selectedCampaign.journeys[i].journey_id);
            console.log("From ID",fromId);


            if (selectedCampaign.journeys[i].environment !== targetEnv && selectedCampaign.journeys[i].journey_id !== fromId){
                toId = selectedCampaign.journeys[i].journey_id;
                break;
            }
        }

        let payload = {
            "campaign":{
                "id":selectedCampaign.id,
                "name":selectedCampaign.name,
                "code":selectedCampaign.code
            },
            "from":{
                "id":fromId,
                "definitionId":fromVersionId,
                "versionNumber":fromVersionNumber,
                "environment":$(el).attr("environment")
            },
            "to":{
                "id":toId,
                "environment":targetEnv
            },
            "environments":schema.Environments
        };

        console.log("Payload",payload);

        $(target).closest("article").find(".card-spinner").show();
        $(target).find("article").remove();


        try {
            let response = await postCopy(payload);
            showToast('success',"Success","Journey successfully copied.");
            console.log("Response",response);
            console.log("Response",JSON.stringify(response.newVersion));
        } catch (e){
            showToast('error',"Error","Error copying journey: " + JSON.stringify(e));
        }

    }

    function postCopy(payload){
        // Build url and request to the proxy service
        var endpoint = window.location.protocol + "//" + window.location.hostname + ":" + window.location.port + "/rest/copy";

        return new Promise(function(resolve, reject) {
            $.ajax({
                type: "POST",
                url: endpoint,
                data: payload,
                success: function(resp) {
                    resolve(resp);
                },
                error: function(response) {
                    reject(response);
                }
            });
        });
    }

    function sortSchema(){
        schema.Fields = schema.Fields.sort(comparePositions);
    }

    function comparePositions(a, b) {
        if (!a.Position)
            return -1;
        if (a.Position < b.Position || a.Position == undefined)
            return -1;
        if (a.Position > b.Position || b.Position == undefined)
            return 1;
        return 0;
    }

    function compareVersions(a, b) {
        if (a.version < b.version)
            return 1;
        if (a.version > b.version)
            return -1;
        return 0;
    }

    async function showForm(){
        // Clear down the form
        $("#campaign-form").find("input[type=text], textarea, select").val("");

        // Clear down environment containers of Journey Cards
        $(".env-container").html("&nbsp;");

        $(".card-spinner").show();

        if (!selectedCampaign.id){
            $('#form-title').html('New Campaign');
            // Todo : Suppress environment panel
        } else {
            $('#form-title').html(selectedCampaign.name);
        }

        for (var p in selectedCampaign) {
            if(p == 'owner'){
                $('#form-' + p).val(getUser(selectedCampaign[p]).name);
            } else {
                $('#form-' + p).val(selectedCampaign[p]);
            }
        }

        let journeyTemplate = $('#journeyCardTemplate').html();
        let journeyRender = Handlebars.compile(journeyTemplate);

        $('#modal-backdrop').show();
        $('#campaign-form').show();

        for (var j in selectedCampaign.journeys) {
            try{
                selectedCampaign.journeys[j]["versions"] = await getJourney(selectedCampaign.journeys[j].journey_id);
                selectedCampaign.journeys[j].versions = selectedCampaign.journeys[j].versions.sort(compareVersions);
            } catch (e){
                console.log(e);
            }

            console.log("Journey",selectedCampaign.journeys[j]);

            let target = $("#env-" + selectedCampaign.journeys[j].environment + "-container");
            console.log("Journey Versions",selectedCampaign.journeys[j].versions);
            $(target).html(journeyRender(selectedCampaign.journeys[j]));
            $(target).closest("article").find(".journey-add-button").hide();

            let journeyId   = selectedCampaign.journeys[j].versions[0].id;
            let versionId   = selectedCampaign.journeys[j].versions[0].definitionId;
            let vTarget      = $(target).find(".version-container");
            console.log("journeyId",journeyId);
            //console.log("versionId",versionId);
            //console.log("target",vTarget);



            showVersion(vTarget,journeyId,versionId);
        }

        $(".card-spinner").hide();

        let els = [];

        for (var env in schema.Environments) {
            //console.log("Environment",schema.Environments[env]);
            //console.log("El","env-" + schema.Environments[env].Name + "-container");
            els.push(document.getElementById("env-" + schema.Environments[env].Name + "-container"));
        }
        //console.log("Drag Containers",els);
        setDragZones(els);

    }

    function showVersion(target,journeyId,versionId){
        $(target).empty();
        let version;

        console.log("selectedCampaign",selectedCampaign);

        for (var j in selectedCampaign.journeys) {
            if(selectedCampaign.journeys[j].journey_id == journeyId){
                //console.log("selectedJourney",selectedCampaign.journeys[j]);
                for (var v in selectedCampaign.journeys[j].versions) {
                    if(selectedCampaign.journeys[j].versions[v].definitionId == versionId){
                        //console.log("selectedVersion",selectedCampaign.journeys[j].versions[v]);
                        version = selectedCampaign.journeys[j].versions[v];
                        break;
                    }
                }
                break;
            }
        }


        if(version){
            let versionTemplate = $('#journeyVersionTemplate').html();
            let versionRender = Handlebars.compile(versionTemplate);
            $(target).html(versionRender(version));
        }
    }

    function getJourney(id){
        // Build url and request to the proxy service
        let endpoint = window.location.protocol + "//" + window.location.hostname + ":" + window.location.port + "/rest/journey/" + id;
        let journey;

        return new Promise(function(resolve, reject) {
            $.ajax({
                type: "GET",
                url: endpoint,
                success: function(resp) {
                    journey = resp;
                    //console.log("Journey",journey)
                    resolve(journey);
                },
                error: function(response) {
                    reject(response);
                }
            });
        });
    }

    function closeForm(){
        $('#modal-backdrop').hide();
        $('#campaign-form').hide();
        $("#campaign-form").find("input[type=text], textarea, select").val("");
    };

    $(document).on("click", "#new-campaign", function(e) {
        selectedCampaign = {"owner":context.id};
        showForm();
    });

    $(document).on("click", ".close-form", function(e) {
        closeForm();
    });

    $(document).on("click", ".journey-add-button button", function(e) {
        $(this).closest('.journey-add-button').find(".slds-dropdown-trigger").toggleClass("slds-is-open");
    });

    $(document).on("change", ".version-select", function(e) {
        let journeyId   = $(this).attr("id").replace('select-','');
        let versionId   = $(this).val();
        let target      = $(this).closest("article").find(".version-container");
        //console.log("journeyId",journeyId);
        //console.log("versionId",versionId);
        //console.log("target",target);
        showVersion(target,journeyId,versionId);
    });

    $(document).on("click", "a.search-val", function(e) {
        let campId = $(this).closest(".campaign-row").attr("id").replace('row-','');
        for (var i=0; i<campaigns.length; i++) {
            if (campaigns[i].id == campId){
                selectedCampaign = campaigns[i];
                showForm();
                return;
            }
        }
        showToast('error','Error','Error finding campaign to edit.');
    });

    $('#search').on('input', function() {
        let term = $(this).val();
        let rows = $(".campaign-row");

        for (var r=0; r<rows.length; r++) {
            let doesContain = false;
            let row = $(rows[r]);
            let vals = row.find('.search-val');
            for (var v=0; v<vals.length; v++) {
                if($(vals[v]).html().toLowerCase().indexOf(term.toLowerCase()) !== -1 || term == ""){
                    doesContain = true;
                    break;
                }
            }
            doesContain ? row.show() : row.hide();
        }
    });

    function getUser(id){
        for (var i=0; i<schema.Users.length; i++) {
            if (schema.Users[i].id == id){
                return schema.Users[i];
            }
        }
        return null;
    }

    function newId() {
        let S4 = function() {
           return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
        };
        return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
    }

}); //Document Ready
