var GuiPlayer_Versions = {
		//Holders
		PlayerData : null,
		resumeTicks : 0,
		playedFromPage : "",
		previousCounter : "",
		
		//Display Details
		selectedItem : 0,
		topLeftItem : 0,
		maxDisplay : 5,
		
		//Holds MediaStream Indexes of Primary Video Audio for each MediaOption
		MediaOptions : [],

		//Holds Playback Details  : MediaSourceId,Url,transcodeStatus,videoIndex,audioIndex
		MediaPlayback : [],

		//Holds all options to show in GUI if required
		MediaSelections : [],
}

GuiPlayer_Versions.start = function(playerData,resumeTicks,playedFromPage) {
	//Reset Vars
	this.MediaOptions.length = 0;
	this.MediaPlayback.length = 0;
	this.MediaSelections.length = 0;
	this.selectedItem = 0,
	this.topLeftItem = 0,
	
	//Set Class Vars
	this.PlayerData = playerData;
	this.resumeTicks = resumeTicks;
	this.playedFromPage = playedFromPage;
	
	//Loop through all media sources and determine which is best
	FileLog.write("Video : Loading " + this.PlayerData.Name)
	FileLog.write("Video : Find Media Streams")
	for(var index = 0; index < this.PlayerData.MediaSources.length;index++) {
		this.getMainStreamIndex(this.PlayerData.MediaSources[index],index);
	}
	
	//Loop through all options and see if transcode is required, generate URL blah...
	FileLog.write("Video : Determine Playback of Media Streams")
	for (var index = 0; index < this.MediaOptions.length; index++) {
		var result = GuiPlayer_Transcoding.start(this.PlayerData.Id, this.PlayerData.MediaSources[this.MediaOptions[index][0]],this.MediaOptions[index][0],
			this.MediaOptions[index][1],this.MediaOptions[index][2],this.MediaOptions[index][3]);
		
		//Toggle D Series Transcoding in Main
		if (Main.getModelYear == "D" && File.getTVProperty("TranscodeDSeries") == false) {
			if (result[2] == "Direct Stream") { 
				FileLog.write("Video : Playback Added")
				this.MediaPlayback.push(result);
			}
		} else {
			FileLog.write("Video : Playback Added")
			this.MediaPlayback.push(result);
		}	
	}
	
	//Setup Gui
	this.previousCounter = document.getElementById("Counter").innerHTML;
	
	//MediaSource,Url,hasVideo,hasAudio,hasSubtitle,videoIndex,audioIndex,subtitleIndex
	if (this.MediaPlayback.length <= 0) {
		FileLog.write("Video : No Playback Options")
		//Error - No media playback options!
		document.getElementById("guiPlayer_Loading").style.visibility = "hidden";
		GuiNotifications.setNotification("None of the MediaSources are playable","Unable To Play");
		//Removes URL to fix Navigation
		Support.removeLatestURL();
		//Return Focus!
		document.getElementById(this.playedFromPage).focus();
	} else if (this.MediaPlayback.length == 1) { //Added in check to play only non transcoded stuff
		//Play file 
		FileLog.write("Video : One Playback Option - Player Loaded")
		GuiPlayer.startPlayback(this.MediaPlayback[0],resumeTicks); //Need to change
	} else {
		//See how many will direct play
		FileLog.write("Video : Multiple Playback Options - Determine Direct Stream Count")
		for (var index = 0; index < this.MediaPlayback.length;index++) {
			if (this.MediaPlayback[index][2] == "Direct Stream") {
				FileLog.write("Video : Found Direct Stream - Added to Selections")
				this.MediaSelections.push(this.MediaPlayback[index]);
			}
		}
		
		//If more than 1 loop through and generate GUI asking user
		if (this.MediaSelections.length == 1) {
			FileLog.write("Video : One Direct Stream - Player Loaded")
			GuiPlayer.startPlayback(this.MediaSelections[0],resumeTicks);
		} else if (this.MediaSelections.length > 1) {
			FileLog.write("Video : Multiple Direct Stream - Option Presented to User")
			document.getElementById("GuiPlayer_Versions").focus();
			this.updateDisplayedItems();
			this.updateSelectedItems();
		} else {
			//None Direct Play - see if any require Audio Only Transcoding
			FileLog.write("Video : None Direct Stream - Determine Audio Only Transcode Count")
			for (var index = 0; index < this.MediaPlayback.length;index++) {
				if (this.MediaPlayback[index][2] == "Transcoding Audio") {
					FileLog.write("Video : Found Audio Only Transcode - Added to Selections")
					this.MediaSelections.push(this.MediaPlayback[index]);
				}
			}
			
			//If more than 1 loop through and generate GUI asking user
			if (this.MediaSelections.length == 1) {
				FileLog.write("Video : One Audio Only Transcode - Player Loaded")
				GuiPlayer.startPlayback(this.MediaSelections[0],resumeTicks);
			} else if (this.MediaSelections.length > 1) {
				FileLog.write("Video : Multiple Audio Only Transcode - Option Presented to User")
				document.getElementById("GuiPlayer_Versions").focus();
				this.updateDisplayedItems();
				this.updateSelectedItems();
			} else {	
				//Just use 1st Source and give up!
				FileLog.write("Video : None Audio Only Transcode - Use First Media Source - Player Started")
				GuiPlayer.startPlayback(this.MediaSelections[0],resumeTicks);
			}
		}
	}
}

GuiPlayer_Versions.updateDisplayedItems = function() {
	document.getElementById("guiPlayer_Versions_Playables").style.visibility = "";
	document.getElementById("guiPlayer_Versions_Playables").innerHTML = "";
	
	for (var index = this.topLeftItem; index < Math.min(this.MediaSelections.length,this.topLeftItem + this.maxDisplay);index++) {
		document.getElementById("guiPlayer_Versions_Playables").innerHTML += "<div id="+this.MediaSelections[index][0].Id+" class=videoVersionOption>"+this.MediaSelections[index][0].Name
		+ "<div class=videoVersionType>D</div></div>";	
	}
}

GuiPlayer_Versions.updateSelectedItems = function() {
	for (var index = this.topLeftItem; index < Math.min(this.MediaSelections.length,this.topLeftItem + this.maxDisplay); index++){	
		if (index == this.selectedItem) {
			document.getElementById(this.MediaSelections[index][0].Id).style.color = "#27a436";	
		} else {	
			document.getElementById(this.MediaSelections[index][0].Id).style.color = "white";		
		}		
	} 
	document.getElementById("Counter").innerHTML = (this.selectedItem + 1) + "/" + this.MediaSelections.length;
}



//Gets Primary Streams - Ones that would be used on first playback)
GuiPlayer_Versions.getMainStreamIndex = function(MediaSource, MediaSourceIndex) {
	var videoStreamIfNoDefault = 0
	var videoIndex = -1, audioIndex = -1;
	var indexOfFirstAudio = -1;
	
	var userURL = Server.getServerAddr() + "/Users/" + Server.getUserID() + "?format=json";
	var UserData = Server.getContent(userURL);
	if (UserData == null) { return; }
	
	var AudioLanguagePreferenece = (UserData.Configuration.AudioLanguagePreference !== undefined) ? UserData.Configuration.AudioLanguagePreference : "none";
	var PlayDefaultAudioTrack = (UserData.Configuration.PlayDefaultAudioTrack !== undefined) ? true: false;
	
	FileLog.write("Video : Audio Play Default Track Setting: " + PlayDefaultAudioTrack);
	FileLog.write("Video : Audio Language Preference Setting: " + AudioLanguagePreferenece);
	
	var MediaStreams = MediaSource.MediaStreams;
	
	//Find 1st Audio Stream
	for (var index = 0;index < MediaStreams.length;index++) {
		var Stream = MediaStreams[index];
		if (Stream.Type == "Audio") {
			indexOfFirstAudio = index;
			FileLog.write("Video : First Audio Index : " + indexOfFirstAudio);
			break;
		} 
	}
	
	for (var index = 0;index < MediaStreams.length;index++) {
		var Stream = MediaStreams[index];
		if (Stream.Type == "Video") {
			videoStreamIfNoDefault = (videoStreamIfNoDefault == 0) ? index : videoStreamIfNoDefault;
			if (Stream.IsDefault == true) {
				videoIndex = index;
				FileLog.write("Video : Default Video Index Found : " + videoIndex);
			}
		} 
		
		if (Stream.Type == "Audio") {
			if (PlayDefaultAudioTrack == false) {
				if (Stream.Language == AudioLanguagePreferenece) {
					audioIndex = index;
					FileLog.write("Video : Audio Language Preference Found : " + audioIndex);
				}
			} else {
				if (Stream.IsDefault == true) {
					audioIndex = index;
					FileLog.write("Video : Default Audio Track Found : " + audioIndex);
				}
			}
		}
	}
	
	//If there was no default video track use first one
	if (videoIndex == -1) {
		videoIndex = videoStreamIfNoDefault;
		FileLog.write("Video : No Default Video Index Found - Use First Video Index : " + videoIndex);
	}

	//If there was no default audio track find others
	if (audioIndex == -1) {	
		for (var index = 0;index < MediaStreams.length;index++) {
			var Stream = MediaStreams[index];
			if (Stream.Type == "Audio") {
				audioIndex = index;
				FileLog.write("Video : No Audio Track Set - Use First Audio Index : " + audioIndex);
				break;
			}
		}
	}

	var audioStreamFirst = (audioIndex == indexOfFirstAudio) ? true : false;
	if (videoIndex > -1 && audioIndex > -1) {
		//Check if item is 3D and if tv cannot support it don't add it to the list!
		if (MediaSource.Video3DFormat !== undefined) {
			//If TV Supports 3d
			alert ("Mediasource is 3D - Checking TV Compatibility")
			var pluginScreen = document.getElementById("pluginScreen");
			if (pluginScreen.Flag3DEffectSupport()) {
				alert ("3D playback supported on TV")
				FileLog.write("Video : Media Stream Added : 3D " + MediaSourceIndex + "," + videoIndex + "," + audioIndex + "," + audioStreamFirst)
				this.MediaOptions.push([MediaSourceIndex,videoIndex,audioIndex,audioStreamFirst]); //Index != Id!!!
			} else {
				FileLog.write("Video : Media Stream Added : 3D - Not Added, TV does not support 3D");
			}
		} else {
			//Not 3D
			FileLog.write("Video : Media Stream Added : 2D " + MediaSourceIndex + "," + videoIndex + "," + audioIndex + "," + audioStreamFirst)
			this.MediaOptions.push([MediaSourceIndex,videoIndex,audioIndex,audioStreamFirst]); // Index != Id!!!
		}				
	} else {
		if (videoIndex == -1) {
			FileLog.write("Video : No Video Index Found - Not Added");
		}
		if (audioIndex == -1) {
			FileLog.write("Video : No Audio Index Found - Not Added");
		}
	}	
}


GuiPlayer_Versions.keyDown = function() {
	var keyCode = event.keyCode;
	alert("Key pressed: " + keyCode);

	if (document.getElementById("Notifications").style.visibility == "") {
		document.getElementById("Notifications").style.visibility = "hidden";
		document.getElementById("NotificationText").innerHTML = "";
		
		//Change keycode so it does nothing!
		keyCode = "VOID";
	}
	
	switch(keyCode) {
		case tvKey.KEY_UP:
			this.selectedItem--;
			if (this.selectedItem < 0) {
				this.selectedItem++;
			}
			if (this.selectedItem < this.topLeftItem) {
				this.topLeftItem--;
				this.updateDisplayedItems();
			}
			this.updateSelectedItems();
		break;
		case tvKey.KEY_DOWN:
			this.selectedItem++;
			if (this.selectedItem > this.MediaSelections.length-1) {
				this.selectedItem--;
			}
			if (this.selectedItem >= this.topLeftItem + this.maxDisplay) {
				this.topLeftItem++;
				this.updateDisplayedItems();
			}
			this.updateSelectedItems();
			break;
		case tvKey.KEY_RETURN:
		case tvKey.KEY_PANEL_RETURN:
			alert("RETURN");
			widgetAPI.blockNavigation(event);
			//Hide Menu
			document.getElementById("guiPlayer_Loading").style.visibility = "hidden";
			document.getElementById("guiPlayer_Versions_Playables").style.visibility = "hidden";
			document.getElementById("guiPlayer_Versions_Playables").innerHTML = "";
			
			//Remove Last URL History - as we didn't navigate away from the page!
			Support.removeLatestURL();
			
			//Reset counter to existing value
			document.getElementById("Counter").innerHTML = this.previousCounter;
			
			//Set focus back to existing page
			document.getElementById(this.playedFromPage).focus();
			break;
		case tvKey.KEY_ENTER:
		case tvKey.KEY_PANEL_ENTER:
			alert("ENTER");
			document.getElementById("guiPlayer_Versions_Playables").style.visibility = "hidden";
			document.getElementById("guiPlayer_Versions_Playables").innerHTML = "";
			document.getElementById("Counter").innerHTML = this.previousCounter;
			document.getElementById(this.playedFromPage).focus();
			GuiPlayer.startPlayback(this.MediaSelections[this.selectedItem],this.resumeTicks);
			break;	
		case tvKey.KEY_BLUE:
			alert("BLUE");
			document.getElementById("guiPlayer_Loading").style.visibility = "hidden";
			File.deleteFile();
			widgetAPI.sendExitEvent()
			break;	
		case tvKey.KEY_EXIT:
			alert ("EXIT KEY");
			document.getElementById("guiPlayer_Loading").style.visibility = "hidden";
			widgetAPI.sendExitEvent();
			break;
		default:
			alert("Unhandled key");
			break;
	}
};