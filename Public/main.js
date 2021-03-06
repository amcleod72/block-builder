let accessToken, roots;
let selectedAssets = {};

// onRender - Function called by iFrame to apps login page
function onRender() {
    roots = JSON.parse(decodeURI(getCookie('sfmc_roots')))

    if (!roots){
        let promise = Promise.all([$.getRoots()]);

        promise.then(function(data) {
            roots = data[0];
            $('#workspace').show();
            $('#spinner').hide();
            $('#modal-backdrop').hide();
        }).catch(function(error) {
            console.log('Error',error);
        });
    } else {
        console.log('Roots','Cached');
        $('#workspace').show();
        $('#spinner').hide();
        $('#modal-backdrop').hide();
    }
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

// Required to make SLDC Date Pickers functional
$.aljsInit({assetsLocation: '.'});

$('document').ready(function() {
    // Instandiate the ContentBuilder SDK
    var sdk = new window.sfdc.BlockSDK();

    // Get Marketing Cloud to request this application's login route
    sdk.triggerAuth('8d023663-4221-4b41-b849-68bedb9b2be3');

    // Pick up saved data from Marketing Cloud
    sdk.getData(async function(data) {
        selectedAssets = data || {};
        validate();
        if(selectedAssets.dataextension && selectedAssets.dataextension.definition){
            buildForm();
        } else {
            let deCookie = getCookie('sfmc_dataextension');
            if (deCookie){
                selectedAssets['dataextension'] = {};
                selectedAssets['dataextension']["definition"] = await getAssetDef('dataextension',deCookie);
                buildForm();
            }
        }

        if(!selectedAssets.asset || !selectedAssets.asset.definition){
            let assetCookie = getCookie('sfmc_asset');
            if (assetCookie){
                selectedAssets['asset'] = {};
                selectedAssets['asset']["definition"] = await getAssetDef('asset',assetCookie)
            }
        }

        if(selectedAssets.row){
            fillForm()
        }
        validate();
        updateMe();
        $('#spinner').hide();
        $('#modal-backdrop').hide();
    });

    const toastTemplate = $('#toastTemplate').html();

    $(document).on("click", ".close-toast", function(e) {
        $("#toast-container").hide();
    });

    $(document).on("click", ".select", function(e) {
        let dataType = ($(e.target).hasClass('dataextension')) ? 'dataextension' : 'asset';
        showSelect(dataType);
    });

    $(document).on("click", ".delete", function(e) {
        let dataType = ($(e.target).hasClass('dataextension')) ? 'dataextension' : 'asset';
        delete selectedAssets[dataType];
        validate();
    });

    $(document).on("click", ".close-select", function(e) {
        closeSelect();
    });

    $(document).on("keypress", ".primary-key", async function(e) {
        $('#spinner').show();
        var keycode = (e.keyCode ? e.keyCode : e.which);
        if(keycode == '13' && $(e.target).hasClass('primary-key')){
            try {
                let primaryKey = $(e.target).val();
                let primaryKeyField = $(e.target).attr('id').replace('form-','');
                let resp = await getRecord(primaryKeyField,primaryKey);
                $('#form-field-container').find("input[type=text], textarea").val("");
                if (resp && resp.length > 0){
                    selectedAssets['row'] = resp[0].Properties.Property || [];
                    fillForm();
                }
                validate();
            } catch (e){
                showToast('error','Marketing Cloud','An error was encountered getting data extension record');
            }
        }
        $('#spinner').hide();
        e.stopPropagation();
    });

    $(document).on("selected.fu.tree", function(event, data) {
        let selectorType = $("#asset-selector").attr("selector-type");
        if(data.target){
            $('#btn-tree-save').prop('disabled', false);
        }
    });

    $(document).on("deselected.fu.tree", function(event, data) {
        $('#btn-tree-save').prop('disabled', true);
    });

    $(document).on("click", "#btn-tree-save", async function(e) {
        $('#spinner').show();
        let selectorType = $("#asset-selector").attr("selector-type");
        let selectedId = $('#asset-selector').tree('selectedItems')[0].id || null;
        selectedAssets[selectorType] = {"id":selectedId,"definition":null};
        try {
            selectedAssets[selectorType]["definition"] = await getAssetDef(selectorType,selectedId)
            setCookie('sfmc_' + selectorType,selectedId,365);
            closeSelect();
            if(selectorType == 'dataextension'){
                buildForm();
            }
            validate();
            updateMe();
        } catch (e){
            showToast('error','Marketing Cloud','An error was encountered getting the definition of ' + $('#asset-selector').tree('selectedItems')[0].name);
            console.log(e);
        } finally {
            $('#spinner').hide();
            $('#modal-backdrop').hide();
        }
        console.log("selectedAssets",selectedAssets);

    });

    function getRecord(primaryKeyField,primaryKey){
        var endpoint = window.location.protocol + "//" + window.location.hostname + ":" + window.location.port;
        endpoint += "/data"
        endpoint += "?" + primaryKeyField;
        endpoint += "=" + primaryKey;

        return new Promise(function(resolve, reject) {
            $.ajax({
                type: "POST",
                url: endpoint,
                contentType: "application/json; charset=utf-8",
                dataType: "json",
                data: JSON.stringify(selectedAssets.dataextension.definition),
                success: function(resp) {
                    resolve(resp);
                },
                error: function(response) {
                    reject(response);
                }
            });
        });
    }

    function validate(){
        if(selectedAssets && selectedAssets.dataextension && selectedAssets.dataextension.definition){
            $('#selected-dataextension-container .asset-info-name-content').html(selectedAssets.dataextension.definition.Name || selectedAssets.dataextension.definition.name);
            $('#unselected-dataextension-container').hide();
            $('#selected-dataextension-container').show();
        } else {
            $('#form-field-container').empty();
            $('#selected-dataextension-container').hide();
            $('#unselected-dataextension-container').show();
        }

        if(selectedAssets && selectedAssets.asset && selectedAssets.asset.definition){
            $('#selected-asset-container .asset-info-name-content').html(selectedAssets.asset.definition.Name || selectedAssets.asset.definition.name);
            $('#unselected-asset-container').hide();
            $('#selected-asset-container').show();
        } else {
            $('#selected-asset-container').hide();
            $('#unselected-asset-container').show();
        }

        sdk.setData(selectedAssets);
    }

    function buildForm(){
        if (selectedAssets && selectedAssets.dataextension && selectedAssets.dataextension.definition && selectedAssets.dataextension.definition.fields){
            $("#form-field-container").empty();
            let schema = selectedAssets.dataextension.definition;
            if (schema.rows && schema.rows.length > 0){
                selectedAssets['row'] = schema.rows[0].Properties.Property;
                delete selectedAssets.dataextension.definition.rows;
            }

            let formRender, template;

            // Sort the fields - Primary Keys First, then by name
            schema.fields.sort(compareFields);

            for (i = 0; i < schema.fields.length; i++) {

                let field = schema.fields[i];
                if (field.IsPrimaryKey.toLowerCase() === 'true'){
                    template = $('#inputPrimaryKeyTemplate').html();
                } else if (field.FieldType.toLowerCase() === 'text' || field.FieldType.toLowerCase() === 'decimal'){
                    if (!field.MaxLength || field.MaxLength > 500){
                        template = $('#inputTextAreaTemplate').html();
                    } else {
                        template = $('#inputTextTemplate').html();
                    }
                } else if (field.FieldType.toLowerCase() === 'number'){
                    template = $('#inputTextTemplate').html();
                } else if (field.FieldType.toLowerCase() === 'date'){
                    template = $('#inputDateTemplate').html();
                } else if (field.FieldType.toLowerCase() === 'boolean'){
                    template = $('#inputCheckTemplate').html();
                } else {
                    template = undefined;
                }

                if (template){
                    formRender = Handlebars.compile(template);
                    $("#form-field-container").append(formRender(field));
                }
            }

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

            fillForm();
        }
    }

    function fillForm(){
        for (var r=0;r<selectedAssets.row.length;r++) {
            let field = selectedAssets.row[r];
            if(isEmpty(field.Value)){
                $('#form-' + field.Name).val("");
            } else {
                $('#form-' + field.Name).val(field.Value);
            }
        }

        updateMe();
    }

    function isEmpty(obj) {
        for(var key in obj) {
            if(obj.hasOwnProperty(key))
                return false;
        }
        return true;
    }

    function compareFields(a,b) {
        if (a.IsPrimaryKey > b.IsPrimaryKey) return -1;
        if (a.IsPrimaryKey < b.IsPrimaryKey) return 1;
        if (a.Name > b.Name) return 1;
        if (a.Name < b.Name) return -1;
        return 0;
    }

    function getAssetDef(selectorType,id){
        var endpoint = window.location.protocol + "//" + window.location.hostname + ":" + window.location.port + "/def/" + selectorType + "/" + id;

        return new Promise(function(resolve, reject) {
            $.ajax({
                type: "GET",
                url: endpoint,
                success: function(resp) {
                    resolve(resp);
                },
                error: function(response) {
                    reject(response);
                }
            });
        });
    }

    function closeSelect(){
        $('#modal-backdrop').hide();
        $('#tree-container').hide();
    };

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

    // types ["info","success","warning","error"]
    function showToast(type, message, description) {
        let options = {"type":type,"message":message,"description":description};
        $("#spinner").fadeOut(200);
        var render = Handlebars.compile(toastTemplate);
        $("#toast-container").html(render(options));
        $("#toast-container").fadeIn(200);
    }

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

    function updateMe() {
        let template = '';
        let payload = {};
        let html = '';
        let inputs = $('#form-field-container').find("input[type=text], textarea");
        selectedAssets.row = [];

        for (var i=0;i<inputs.length;i++) {
            let fieldName = $(inputs[i]).attr('id').replace('form-','');
            let fieldValue = $(inputs[i]).val();
            selectedAssets.row.push({
                "Name":fieldName,
                "Value":fieldValue
            });

            if(isEmpty(fieldValue)){
                payload[fieldName] = null;
            } else {
                payload[fieldName] = fieldValue;
            }
        }

        console.log("selectedAssets",selectedAssets);

        if (selectedAssets && selectedAssets.asset && selectedAssets.asset.definition && selectedAssets.asset.definition.content){
            template = selectedAssets.asset.definition.content;
        } else {
            showMessage('error');
        }

        if (selectedAssets && selectedAssets.row){
            let render = Handlebars.compile(template);
            html = render(payload);
            sdk.setSuperContent(html);
            sdk.setContent(html);
        }

        sdk.setData(selectedAssets);
    }

    function showMessage(type){
        if (type === 'error'){
            sdk.setSuperContent('<div style="font-family: Helvetica, Sans-Serif; font-size: 20px; line-height: 50px; text-align: center; height: 50px; text-align: center; background-color: red; color:white; min-width:100%;">No Content - Please Configure</div>');
        } else {
            sdk.setSuperContent('<div style="font-family: Helvetica, Sans-Serif; font-size: 20px; line-height: 50px; text-align: center; height: 50px; text-align: center; background-color: green; color:white; min-width:100%;">Content - Configured</div>');
        }
    }

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

    document.getElementById('workspace').addEventListener("input", function() {
        debounce(updateMe, 500)();
    });
});

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
