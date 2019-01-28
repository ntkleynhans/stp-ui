// Editor module

var Editor = (function (window, document, $, undefined) {

    var module = {};

    $(document).on( 'ready', check_browser );

    // EDITOR WAVESURFER
    var ALIGNMENT_DURATION_MAX = 120.0;
    var RECOGNITION_DURATION_MAX = 120.0;
    var MIN_AUDIO_ZOOM = 5.0;

    var wavesurfer = null;
    var timeline = null;
    var editor_height_constant = 0.50;
    var waveform_height_constant = 0.14;
    var waveform_width_pixel = null;
    var audio_skip_length = 5.0;
    var audioCtx = null;
    var editor_inst;
    var speech_service_language = null;
    var notset = ["null", null, undefined];
    var job;
    var languages;
    var diarize_sub;
    var recognize_sub;
    var align_sub;
    var ck_audio_playback_rate = 1.0;
    var playing = false;
    var saving_timer = null;
    var AUTO_SAVE = 120 * 1000;

    // Make sure user is using chrome
    function check_browser() {
        document.body.className = 'vbox viewport';

	    var is_chrome = /chrome/.test( navigator.userAgent.toLowerCase() );
	    if((is_chrome == false) || (is_chrome == null)) {
		    alertify.alert('Sorry you must use Chrome!', function(){});
		    window.location.assign(CHROME_URL);
	    }

        if(localStorage.getItem("role") === null) {
            alertify.alert("No role selected from Home page! Redirecting you back to the Home page...", function(){});
		    window.location.assign(HOME_URL);
        }

        if(localStorage.getItem("token") === null) {
            alertify.alert("No token found! Redirecting you back to the Home page...", function(){});
		    window.location.assign(HOME_URL);
        }

        if(localStorage.getItem("job") === null) {
            alertify.alert("No Job information found! Redirecting you back to the Home page...", function(){});
		    window.location.assign(HOME_URL);
        }

        // Extract job information
        job = JSON.parse(localStorage.getItem("job"));
        localStorage.setItem("projectid", job["projectid"]);
        localStorage.setItem("taskid", job["taskid"]);
        speech_service_language = job["language"];
        languages = job["languages"];
        languages.sort();
        diarize_sub = job["diarize_sub"];
        recognize_sub = job["recognize_sub"];
        align_sub = job["align_sub"];

        // Set job info
        var ts = document.getElementById("taskinfo");
        var content;
        content = "<span style='padding: 1%;'><font color='#395870'>PROJECT NAME:</font> " + job["projectname"] + "</span>";
        content += "<span style='padding: 1%;'><font color='#395870'>JOB ID:</font> " + job["taskid"] + "</span>";
        content += "<span style='padding: 1%;'><font color='#395870'>CATEGORY:</font> " + job["category"] + "</span>";
        content += "<span style='padding: 1%;'><font color='#395870'>LANGUAGE:</font> " + job["language"] + "</span>";
        content += "<span style='padding: 1%;'><font color='#395870'>SPEAKER:</font> " + job["speaker"] + "</span>";
        var ddate = new Date(1970,0,1);
        ddate.setSeconds(parseFloat(job["start"]));
	var display_time = ddate.getHours() + ':' + ddate.getMinutes() + ':' + ddate.getSeconds();
        content += "<span style='padding: 1%;'><font color='#395870'>START TIME:</font> " + display_time + "</span>";
        content += "<span style='padding: 1%;'><button style='padding: 0px; margin: 0px; font: 0.9em;' onclick='Editor.close_save()'>Go Back</button> </span>";
        ts.innerHTML = content;

        // Initialize editor
	    init_editor();
	    wavesurfer = null;
    }

    var ck_ev = null;
    // Get CKEditor ready
    function init_editor() {
	    var editor_height = Math.round(window.innerHeight * editor_height_constant);

	    // Initialise CKEditor
	    editor_inst = CKEDITOR.replace( 'trans_editor',
	    {
		    height: editor_height,
		    allowedContent: true,
		    startupFocus: true,
		    extraPlugins : 'audio,inserttimemark,audiozoom,audiorate,removemustformat,allowsave,loadtext,closedocument,clearerror,diarizeaudio,recognizeaudio,alignaudio,sphlang',
		    toolbar :
		    [
			    { name: 'audiotools', items : [ 'Backward Audio', 'Play Audio', 'Pause Audio', 'Stop Audio', 'Forward Audio'] },
			    { name: 'timealignment', items : ['Audio Zoom', 'Audio Rate']},
			    { name: 'timealignment', items : ['Time Mark']},
			    { name: 'format', items : ['RemoveMustFormat']},
			    { name: 'speechservives', items : ['sphlang', 'Create Audio Segments', 'Generate A Transcription', 'Align Audio and Text']},
                '/',
			    { name: 'document', items : ["Save", "Load Text", 'Close Document', 'Clear Error'] },
			    { name: 'clipboard', items: [ 'Cut', 'Copy', 'Paste', 'PasteText', 'PasteFromWord', '-', 'Undo', 'Redo' ] }, 
			    { name: 'find', items: ["Find", "Replace", "SelectAll"] },
			    { name: 'basicstyles', items : [ 'Bold','Italic', "Underline", "Strike", "Subscript", "Superscript" ] },
			    { name: 'text', items: ["JustifyLeft", "JustifyCenter", "JustifyRight"] },
			    { name: 'paragraph', items : [ 'NumberedList','BulletedList', 'Table', 'SpecialChar' ] },
			    { name: 'fonts', items : [ 'Font','FontSize', 'TextColor', 'BGColor', 'Format' ] },
			    { name: 'tools', items : [ 'Source' ] }
		    ]
	    });

        CKEDITOR.config.removePlugins = 'scayt,dragdrop,basket';
        CKEDITOR.config.disableNativeSpellChecker = true;
        CKEDITOR.config.scayt_autoStartup = false;

        var lang = "en_uk";
        switch(speech_service_language) {
            case "Afrikaans":
                lang = "af";
                break;
            case "English":
                lang = "en_uk";
                break;
            case "isiZulu":
                lang = "zu";
                break;
            case "Setswana":
                lang = "tn";
                break;
            default:
                lang = "en_uk";
                break;
        }
        alertify.success("Spell checker set to " + speech_service_language);

        nanospell.ckeditor('trans_editor',{ 
            dictionary : lang,  // 24 free international dictionaries  
            server : "php"      // can be php, asp, asp.net or java
        });

	    CKEDITOR.on("instanceReady", function(ev) {
		    // insert code to run after editor is ready
            ck_ev = ev;
            ev.editor.setReadOnly(true);
            alertify.error("Editor disabled till audio loaded...");
    	    load_text();
		    load_audio();

		    editor_inst.addCommand( "save", {
			    modes : { wysiwyg:1 },
			    exec : function () {
				    module.save();
			    }
		    });
   	    saving_timer = setInterval(module.save, AUTO_SAVE); 
            });
    }

    // Add event to check if user has clicked on the editor text area
    function add_click_handler() {
	    CKEDITOR.instances.trans_editor.on( 'contentDom', function() {
	        var editable = CKEDITOR.instances.trans_editor.editable();
	        editable.attachListener(CKEDITOR.instances.trans_editor.document, 'click', function(event) {
			    text_clicked(event);
	        });
	    });
    }

    function add_key_handler() {
        //CKEDITOR.instances.trans_editor.on('key', function() {
        //    console.log('Key');
        //});
	    CKEDITOR.instances.trans_editor.on( 'contentDom', function() {
	        var editable = CKEDITOR.instances.trans_editor.editable();
	        editable.attachListener(CKEDITOR.instances.trans_editor.document, 'keydown', function(event) {
			    keydown(event);
	        });
	    });
    }

    function keydown(event) {
        if(event.data.getKeystroke() == 120) {
            if(playing) {
                wavesurfer.pause();
                playing = false;
            } else {
                wavesurfer.play();
                playing = true;
            }
        }
        if(event.data.getKeystroke() == 115) {
            wavesurfer.stop();
            wavesurfer.setPlaybackRate(1.0);
            ck_audio_playback_rate = 1.0;
	}
        if(event.data.getKeystroke() == 118) {
            wavesurfer.skipBackward(1.0);
        }
        if(event.data.getKeystroke() == 119) {
            wavesurfer.skipForward(1.0);
        }
        if(event.data.getKeystroke() == CKEDITOR.ALT + 83) {
            module.save();
        }
        if(event.data.getKeystroke() == 113) {
            ck_audio_playback_rate -= 0.1;
            if(ck_audio_playback_rate < 0) {
               ck_audio_playback_rate = 0.1;
            }
            wavesurfer.setPlaybackRate(ck_audio_playback_rate);
        }
    }

    // Get wavesurfer ready - if an audio url is available
    function init_wavesurfer(audio_url) {
	    var audioCtx = new AudioContext();

	    // Initialise wavesurfer
	    wavesurfer = Object.create(WaveSurfer);

	    var waveform_height = Math.round(window.innerHeight * waveform_height_constant);

	    wavesurfer.init({
		    audioContext : audioCtx,
            container: '#waveform',
            waveColor: 'violet',
            progressColor: '#AAAAAA',
            scrollParent: true,
            fillParent: false,
            minPxPerSec: 10,
            height: waveform_height,
            barHeight: 1,
            pixelRatio: 1
	    });

	    wavesurfer.on('ready', function () {
		    timeline = Object.create(WaveSurfer.Timeline);

		    timeline.init({
		        wavesurfer: wavesurfer,
                primaryLabelInterval: 1,
                secondaryLabelInterval: 1,
		        container: "#waveform_timeline"
		    });

		    //if(wavesurfer.getDuration() < 20.0) {
			audio_zoom_change(wavesurfer.getDuration());
		    //} else {
			//    audio_zoom_change(20.0);
		    //}

            module.wavesurfer = wavesurfer;

            if(job["readOnly"] === true) {
                alertify.success("Editor in Read-Only mode");
            } else {
                ck_ev.editor.setReadOnly(false);
            }

	    });

	    if(audio_url != null) {
		    wavesurfer.load(audio_url);
	    }
	    waveform_width_pixel = $('#waveform_timeline').width();
    }

    // Enable click event again as setData creates an new editor instance
    function set_editor_text() {
	    add_click_handler();
	    add_key_handler();
	    CKEDITOR.instances.trans_editor.setMode('source');
	    CKEDITOR.instances.trans_editor.setMode('wysiwyg');
	    CKEDITOR.instances.trans_editor.resetDirty();
    }

    // Public get languages
    module.getlanguages = function() {
        return languages;
    }

    //Load saved text 
    var editor_html;
    function load_text() {
        document.body.className = 'vbox viewport waiting';
        var data = {};
        data["token"] = localStorage.token;
        data["projectid"] = localStorage.projectid;
        data["taskid"] = localStorage.taskid;
        appserver_send(APP_EGETTEXT, data, load_text_callback);
    }

    // Public load text
    module.load_text = function () {
        if(CKEDITOR.instances.trans_editor.checkDirty() == true) {
            alertify.confirm('There are unsaved text changes. Proceed with loading text?',
            function() {
                load_text();
            }, function(){"Load text canceled"});
        } else {
            load_text();
        }
    };

    //load text callback
    var editor_html;
    function load_text_callback(xmlhttp) {
	    if ((xmlhttp.status==503)) {
		    alertify.alert("Application server unavailable", function(){});
	    }
	    if ((xmlhttp.readyState==4) && (xmlhttp.status != 0)) {
		    var response_data = JSON.parse(xmlhttp.responseText);
		    if(xmlhttp.status==200) {
                alertify.success("Text loaded");
		        editor_html = response_data["text"];
		        CKEDITOR.instances.trans_editor.focus();
		        CKEDITOR.instances.trans_editor.setData(editor_html, set_editor_text);
                document.body.className = 'vbox viewport';
		    } else { // Something unexpected happened
			    alertify.alert("LOADTEXT ERROR: " + response_data["message"], function(){});
                document.body.className = 'vbox viewport';
		    }
	    }

        if ((xmlhttp.readyState==4) && (xmlhttp.status == 0)) {
            alertify.alert("LOADTEXT Network Error. Please check your connection and try again later!", function(){});
            document.body.className = 'vbox viewport';
        }
    }

    // Clear this wavesurfer instance
    function destory_wavesurfer() {
	    if(wavesurfer != null) {
		    wavesurfer.destroy();
	    }
    }

    //Load the job's audio
    function load_audio() {
	    destory_wavesurfer();
        var data_url = APP_EGETAUDIO;
        data_url += "?token=" + localStorage.token;
        data_url += "&projectid=" + localStorage.projectid;
        data_url += "&taskid=" + localStorage.taskid;
	    init_wavesurfer(data_url);
    }

    // Check if editor text area is blank
    function check_textarea_blank() {
	    var text_string = CKEDITOR.instances.trans_editor.getData();

	    if (text_string.length == 0) {
		    return true;
	    } else {
		    return false;
	    }
    }

    // Adjust waveform zoom
    function audio_zoom_change(seconds) {
	    // Do some basic duration checks
	    //TODO: minimum value is a bit ad-hoc
	    if(seconds < MIN_AUDIO_ZOOM) {
		    seconds = MIN_AUDIO_ZOOM;
	    }

	    if(seconds > wavesurfer.getDuration()) {
		    seconds =  wavesurfer.getDuration();
	    }

	    wavesurfer.zoom(waveform_width_pixel / seconds);
    }
    module.audio_zoom_change = function(seconds) { audio_zoom_change(seconds); };

    // Adjust waveform playback rate
    function audio_rate_change(seconds) {
	    // Do some basic duration checks
	    //TODO: minimum value is a bit ad-hoc
	    if(seconds < 0.5) {
		    seconds = 0.5;
	    }

	    if(seconds > 2.0) {
		    seconds =  2.0;
	    }

	    wavesurfer.setPlaybackRate(seconds);
    }
    module.audio_rate_change = function(seconds) { audio_rate_change(seconds); };

    // Return the audio skip length
    module.get_audio_skip_length = function() {
        return audio_skip_length;
    }

    // User clicked on some text; adjust the position in the stream
    function text_clicked(event) {
	    var ranges = CKEDITOR.instances.trans_editor.getSelection().getRanges();
	    var text = CKEDITOR.instances.trans_editor.getSelection().getSelectedText();
	    var element = CKEDITOR.instances.trans_editor.getSelection().getStartElement();

	    if((ranges[0] != undefined) || (ranges[0] != null)) {
		    var selection_length = (ranges[0].endOffset - ranges[0].startOffset);
		    // User can click on a time marker
		    if(selection_length == 0) {
			    if (element.getName() == 'time' ) {
				    var mark = $('<p>' + element.getOuterHtml() + '</p>').find('time:first').attr('type');
				    if(mark != null) {
					    var goto_time = $('<p>' + element.getOuterHtml() + '</p>').find('time:first').attr('datetime');
					    var duration = wavesurfer.getDuration();
					    wavesurfer.seekAndCenter(goto_time / duration);
				    }
			    }
	    // User has selected a word
		    } else { 
			    var node = ranges[0];
			    var pnode = node.startContainer.getParent();
			    if (pnode.getName() == 'time' ) {
				    var goto_time = $('<p>' + pnode.getOuterHtml() + '</p>').find('time:first').attr('datetime');
				    var duration = wavesurfer.getDuration();
				    wavesurfer.seekAndCenter(goto_time / duration);
			    }
			    else if(pnode.getName() == "conf") {
				    pnode = pnode.getParent();
				    var goto_time = $('<p>' + pnode.getOuterHtml() + '</p>').find('time:first').attr('datetime');
				    var duration = wavesurfer.getDuration();
				    wavesurfer.seekAndCenter(goto_time / duration);
			    }
		    }
	    }
    }

    // Save text
    module.save = function() {
        document.body.className = 'vbox viewport waiting';
        var data = {};
	    data["token"] = localStorage.token;
        data["projectid"] = localStorage.projectid;
        data["taskid"] = localStorage.taskid;
        data["text"] = CKEDITOR.instances.trans_editor.getData();
	    appserver_send(APP_ESAVETEXT, data, save_text_callback);
    }

    //Save the text callback
    function save_text_callback(xmlhttp) {
	    if ((xmlhttp.status==503)) {
		    alertify.alert("Application server unavailable", function(){});
	    }
	    if ((xmlhttp.readyState==4) && (xmlhttp.status != 0)) {
		    var response_data = JSON.parse(xmlhttp.responseText);
		    if(xmlhttp.status==200) {
			    CKEDITOR.instances.trans_editor.resetDirty();
                alertify.success("Text Saved!");
                document.body.className = 'vbox viewport';
		    } else { // Something unexpected happened
			    alertify.alert("SAVETEXT ERROR: " + response_data["message"], function(){});
                document.body.className = 'vbox viewport';
		    }
	    }

        if ((xmlhttp.readyState==4) && (xmlhttp.status == 0)) {
            alertify.alert("SAVETEXT Network Error. Please check your connection and try again later!", function(){});
            document.body.className = 'vbox viewport';
        }
    }

    // User has changed the language
    module.set_speech_language = function(value) {
        alertify.success("Language set to: " + value);
        speech_service_language = value;
    }

    // Call a speech service - diarize, recognize or align
    module.speech_service = function(name) {
        if(CKEDITOR.instances.trans_editor.checkDirty() == true) {
            alertify.alert("There are unsaved changes. Please save changes before calling the speech service!", function(){});
            return false;
        }

        if(!speech_service_language) {
            alertify.alert("Please select a language before calling a speech service!", function(){});
            return false;
        }

        document.body.className = 'vbox viewport waiting';
        var data = {};
	    data["token"] = localStorage.token;
        data["projectid"] = localStorage.projectid;
        data["taskid"] = localStorage.taskid;

        if(name == "diarize") {
            data["subsystem"] = "default";
        	//appserver_send(APP_EDIARIZE, data, speech_service_callback);
        }
        else if(name == "recognize") {
            data["language"] = speech_service_language;
        	//appserver_send(APP_ERECOGNIZE, data, speech_service_callback);
        }
        else if(name == "align") {
            data["language"] = speech_service_language;
            //appserver_send(APP_EALIGN, data, speech_service_callback);
        } else {
            alertify.alert("Unknown requested speech service: " + name + "!", function(){});
        }
    }

    // Speech service callback
    function speech_service_callback(xmlhttp) {
	    if ((xmlhttp.status==503)) {
		    alertify.alert("Application server unavailable", function(){});
	    }
	    if ((xmlhttp.readyState==4) && (xmlhttp.status != 0)) {
		    var response_data = JSON.parse(xmlhttp.responseText);
		    if(xmlhttp.status==200) {
                alertify.alert("Speech service request successful.\nClosing down editor and locking the job.", function(){
			        localStorage.setItem("taskid", '');
			        localStorage.setItem("projectid", '');
			        localStorage.removeItem("taskid");
			        localStorage.removeItem("projectid");
                    document.body.className = 'vbox viewport';
                    window.location.assign(JOB_URL);
                });
		    } else { // Something unexpected happened
			    alertify.alert("SPEECHSERVICE ERROR: " + response_data["message"], function(){});
                document.body.className = 'vbox viewport';
		    }
	    }

        if ((xmlhttp.readyState==4) && (xmlhttp.status == 0)) {
            alertify.alert("SPEECHSERVICE Network Error. Please check your connection and try again later!", function(){});
            document.body.className = 'vbox viewport';
        }
    }

    // Save text and close the editor
    module.close_save = function() {
        if(CKEDITOR.instances.trans_editor.checkDirty() == true) {
            alertify.confirm('There are unsaved changes. Leave anyway?',
                function() {
                   var items = ["taskid", "projectid", "job"];
                    for(var ndx = 0; ndx < items.length; items++) {
            	        localStorage.setItem(items[ndx], '');
            	        localStorage.removeItem(items[ndx]);
                    }
                    clearInterval(saving_timer);
                    window.location.assign(JOB_URL);
                }, function(){ alertify.error("Cancel")});
        } else {
                   var items = ["taskid", "projectid", "job"];
                    for(var ndx = 0; ndx < items.length; items++) {
            	        localStorage.setItem(items[ndx], '');
            	        localStorage.removeItem(items[ndx]);
                    }
                    window.location.assign(JOB_URL);
        }
    }

    //Clear error state of job
    module.clearerror = function() {
        document.body.className = 'vbox viewport waiting';
        var data = {};
	    data["token"] = localStorage.token;
        data["projectid"] = localStorage.projectid;
        data["taskid"] = localStorage.taskid;
	    appserver_send(APP_ECLEARERROR, data, clearerror_callback);
    }

    //Clear error callback
    function clearerror_callback(xmlhttp) {
	    if ((xmlhttp.status==503)) {
		    alertify.alert("Application server unavailable", function(){});
	    }
	    if ((xmlhttp.readyState==4) && (xmlhttp.status != 0)) {
		    var response_data = JSON.parse(xmlhttp.responseText);
		    if(xmlhttp.status==200) {
                alertify.success("Error cleared");
                document.body.className = 'vbox viewport';
		    } else { // Something unexpected happened
			    alertify.alert("CLEARERROR ERROR: " + response_data["message"], function(){});
                document.body.className = 'vbox viewport';
		    }
	    }

        if ((xmlhttp.readyState==4) && (xmlhttp.status == 0)) {
            alertify.alert("CLEARERROR Network Error. Please check your connection and try again later!", function(){});
            document.body.className = 'vbox viewport';
        }
    }

    return module;

})(window, document, jQuery);

