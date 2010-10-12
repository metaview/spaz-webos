function MessageDetailAssistant(argFromPusher) {
	/* this is the creator function for your scene assistant object. It will be passed all the 
	   additional parameters (after the scene name) that were passed to pushScene. The reference
	   to the scene controller (this.controller) has not be established yet, so any initialization
	   that needs the scene controller should be done in the setup function below. */
	scene_helpers.addCommonSceneMethods(this);

	sc.setDumpLevel(5);
	
	/*
		this connects App to this property of the appAssistant
	*/
	App = Spaz.getAppObj();
	
	Mojo.Log.error('argFromPusher: %j', argFromPusher);
	
	if (sc.helpers.isString(argFromPusher) || sc.helpers.isNumber(argFromPusher)) {
		/*
			we were passed a single arg, so we need to retrieve the message data
		*/
		this.status_id  = argFromPusher;
	} else {
		this.passed_status_obj = argFromPusher.status_obj;
		this.status_id  = argFromPusher.status_id;
		this.isdm  = argFromPusher.isdm;
	}
	
	this.statusobj = null;

}

MessageDetailAssistant.prototype.aboutToActivate = function(callback){
	callback.defer(); //delays displaying scene, looks better
};

MessageDetailAssistant.prototype.setup = function() {

	var thisA = this;
	
	this.initTwit();
	
	this.scroller = this.controller.getSceneScroller();
	
	if (App.username) {
		this.setupCommonMenus({
			viewMenuItems: [
				{
					items: [
						{label: $L("Message Details"), command:'scroll-top', width:260},
						{label: $L('Compose'),  icon:'compose', command:'compose', shortcut:'N'}

					]
				}

			],
			cmdMenuItems:[
				{},
				{
					items:[
						{label:$L('Reply'),  icon:'reply', command:'reply', shortcut:'R'},
						{label:$L('Share'),  icon:'forward-email',  command:'share', shortcut:'S'},
						{label:$L('Favorite'), iconPath:'images/theme/menu-icon-favorite-outline.png', command:'favorite', disabled:true, shortcut:'F'},
						{label:$L('Delete'),  icon:'stop', command:'delete', disabled:true, shortcut:'D'}
					]
				},
				{}
			]
		});
		
		this.initAppMenu({ 'items':LOGGEDIN_APPMENU_ITEMS });
		
		
		this.setCommand('reply', function(e) {
			if (thisA.statusobj) {
				var screen_name;
				if (thisA.statusobj.SC_is_dm) {
					screen_name = thisA.statusobj.sender.screen_name;
					thisA.prepDirectMessage(screen_name);
				} else {
					screen_name = thisA.statusobj.user.screen_name;
					thisA.prepReply(screen_name, thisA.statusobj.id, thisA.statusobj);
				}

			} else {
				Mojo.Log.error('this.statusobj not yet defined');
			}
		});
		this.setCommand('share', function(e) {
			if (thisA.statusobj) {
				thisA.showShareMenu(e, thisA.statusobj);
			} else {
				Mojo.Log.error('this.statusobj not yet defined');
			}
		});
		this.setCommand('favorite', function(e) {
			Mojo.Log.error('called favorite handler');
			if (thisA.statusobj) {
				Mojo.Log.error('statusobj defined');
				if (thisA.statusobj.SC_is_dm) {
					Mojo.Log.error("can't fave a dm");
					return; // can't fave a dm
				} else {
					if (thisA.statusobj.favorited) {
						Mojo.Log.error('UNFAVORITING %j', thisA.statusobj);
						thisA.twit.unfavorite(
							thisA.statusobj.id,
							function(data) {
								thisA.statusobj.favorited = false;
								thisA.setFavButtonState();
								thisA.showBanner($L('Removed favorite'));
							},
							function(xhr, msg, exc) {
								thisA.showBanner($L('Error removing favorite'));
							}
						);
					} else {
						Mojo.Log.error('FAVORITING %j', thisA.statusobj);
						thisA.twit.favorite(
							thisA.statusobj.id,
							function(data) {
								thisA.statusobj.favorited = true;
								thisA.setFavButtonState();
								thisA.showBanner($L('Added favorite'));								
							},
							function(xhr, msg, exc) {
								thisA.showBanner($L('Error adding favorite'));
							}
						);
					}
				}
			} else {
				Mojo.Log.error('this.statusobj not yet defined');
			}
		});
		this.setCommand('delete', function(e) {
			if (thisA.statusobj) {
				
				thisA.showAlert(
					$L('Do you want to delete this message?'),
					$L('Confirm Delete'),
					function(choice) {
						switch(choice) {
							case 'yes':
								var status_id = thisA.statusobj.id;
								if (thisA.statusobj.SC_is_dm) {
									thisA.deleteDirectMessage(status_id);
								} else {
									thisA.deleteStatus(status_id);
								}

								Mojo.Controller.stageController.popScene({'returnFromPop':true});
								break;

							default:
						}
						return true;
					},
					[
						{label:$L('Yes'), value:"yes", type:'negative'},
						{label:$L('No'), value:"no", type:'dismiss'}
					]
				);
				
			}
		});
		
		
	} else {
		this.setupCommonMenus({
			viewMenuItems: [
				{
					items:[
						{label: $L("Message Details"), command:'scroll-top', 'class':"palm-header left", width:320}				
					]
				}

			],
			cmdMenuItems:[]
		});
		
		this.initAppMenu();
		
	};	
	
	jQuery(document).bind('get_one_status_succeeded', { thisAssistant:this }, this.processStatusReturn);

	jQuery(document).bind('get_one_status_failed', { thisAssistant:this }, function(e, error_obj) {
		var err_msg = $L("There was an error retrieving this status");
		thisA.displayErrorInfo(err_msg, error_obj);		
	});

	
	
	/* this function is for setup tasks that have to happen when the scene is first created */
		
	/* use Mojo.View.render to render view templates and add them to the scene, if needed. */
	
	/* setup widgets here */
	
	/* add event handlers to listen to events from widgets */
};

MessageDetailAssistant.prototype.activate = function(event) {
	
	var thisA = this;
	
	/* put in event handlers here that should only be in effect when this scene is active. For
	   example, key handlers that are observing the document */
	
	if (this.isdm) {
		if (this.passed_status_obj){
			jQuery(document).trigger('get_one_status_succeeded', [this.passed_status_obj]);
		} else {
			App.Tweets.get(this.status_id, this.isdm,
				function(data) {
					if (data !== null) {
						Mojo.Log.error('Message '+thisA.status_id+' pulled from DB');
						jQuery(document).trigger('get_one_status_succeeded', [data]);
					} else { // if nothing is returned, get it from Twitter
						Mojo.Log.error('DM was not in App.Tweets cache');
						thisA.showAlert($L('There was an error retrieving this direct message from cache'));
					}
					
				},
				function(message) {
					Mojo.Log.error('Couldn\'t retrieve message from Depot:'+message);
					thisA.showAlert($L('There was an error retrieving the message data'));
				}
			);
		}
	} else {
		App.Tweets.get(
			this.status_id,
			this.isdm,
			function(data) {
				Mojo.Log.error('Status pulled from DB');
				jQuery(document).trigger('get_one_status_succeeded', [data]);
			},
			function(xhr) {
				Mojo.Log.error('Couldn\'t retrieve message from Depot: %j', xhr);
				thisA.showAlert($L('There was an error retrieving the message data'));
			}
		);
	}
	

	jQuery('#message-detail-container .in-reply-to-link', this.scroller).live(Mojo.Event.tap, function(e) {
		var statusid = jQuery(this).attr('data-irt-status-id');
		Mojo.Controller.stageController.pushScene('message-detail', statusid);
	});



	jQuery('#message-detail-image', this.scroller).live(Mojo.Event.tap, function(e) {
		var userid = jQuery(this).attr('data-user-id');
		Mojo.Controller.stageController.pushScene('user-detail', userid);
	});
	
	

	
	
	
	
	jQuery('#message-detail-container .user', this.scroller).live(Mojo.Event.tap, function(e) {
		var userid = jQuery(this).attr('data-user-id');
		Mojo.Controller.stageController.pushScene('user-detail', userid);
	});

	jQuery('#message-detail-container .username.clickable', this.scroller).live(Mojo.Event.tap, function(e) {
		var userid = jQuery(this).attr('data-user-screen_name');
		Mojo.Controller.stageController.pushScene('user-detail', '@'+userid);
	});

	jQuery('#message-detail-container .hashtag.clickable', this.scroller).live(Mojo.Event.tap, function(e) {
		var hashtag = jQuery(this).attr('data-hashtag');
		thisA.searchFor('#'+hashtag);
	});

	jQuery('#message-detail-container div.timeline-entry>.status>.meta', this.scroller).live(Mojo.Event.tap, function(e) {
		var statusid = jQuery(this).attr('data-status-id');
		Mojo.Controller.stageController.pushScene('message-detail', statusid);
	});
	
	jQuery('#message-detail-container img.thumbnail', this.scroller).live(Mojo.Event.tap, function(e) {
		var siu = new SpazImageURL();
		var img_url = jQuery(this).attr('data-img-url');
		sch.debug('MAIN URL:'+img_url);
		img_url = siu.getImageForUrl(img_url);
		sch.debug('IMAGE URL:'+img_url);
		Mojo.Controller.stageController.pushScene('view-image', {'imageURLs':[img_url]});
	});
	
	// this.addPostPopup();
};


MessageDetailAssistant.prototype.deactivate = function(event) {
	jQuery('#message-detail-container .in-reply-to-link', this.scroller).die(Mojo.Event.tap);
	jQuery('#message-detail-image', this.scroller).die(Mojo.Event.tap);
	
	jQuery('#message-detail-container .user', this.scroller).die(Mojo.Event.tap);
	jQuery('#message-detail-container .username.clickable', this.scroller).die(Mojo.Event.tap);
	jQuery('#message-detail-container .hashtag.clickable', this.scroller).die(Mojo.Event.tap);
	jQuery('#message-detail-container div.timeline-entry>.status>.meta', this.scroller).die(Mojo.Event.tap);
	jQuery('#message-detail-container img.thumbnail', this.scroller).die(Mojo.Event.tap);
	
};

MessageDetailAssistant.prototype.cleanup = function(event) {
	jQuery(document).unbind('get_one_status_succeeded');
	jQuery(document).unbind('get_one_status_failed');
};


MessageDetailAssistant.prototype.processStatusReturn = function(e, statusobj) {
	var itemhtml;
	
	var sui = new SpazImageURL();
	
	sch.dump(e.data.thisAssistant);

	if (!statusobj.SC_is_dm) {
		statusobj.isSent = (statusobj.user.screen_name.toLowerCase() === App.username.toLowerCase());
	}

	e.data.thisAssistant.statusobj = statusobj;
	e.data.thisAssistant.statusRetrieved = false;

	Mojo.Log.error('message data: %j', e.data.thisAssistant.statusobj);
	
	e.data.thisAssistant.statusobj.SC_thumbnail_urls = sui.getThumbsForUrls(e.data.thisAssistant.statusobj.text);
	e.data.thisAssistant.statusobj.text = Spaz.makeItemsClickable(e.data.thisAssistant.statusobj.text);
	
	/*
		save this tweet to Depot
	*/
	// App.Tweets.save(statusobj);
	
	/*
		render tweet
	*/
	if (e.data.thisAssistant.isdm) {
		itemhtml = App.tpl.parseTemplate('message-detail-dm', e.data.thisAssistant.statusobj);
	} else {
		itemhtml = App.tpl.parseTemplate('message-detail', e.data.thisAssistant.statusobj);
	}
	
	
	jQuery('#message-detail').html(itemhtml);
	
	sch.updateRelativeTimes('#message-detail .status>.meta>.date>.date-relative', 'data-created_at');

			
	
	if (e.data.thisAssistant.statusobj.isSent || e.data.thisAssistant.statusobj.SC_is_dm) {
		e.data.thisAssistant.enableDeleteButton(true);
	}
	
	if (!e.data.thisAssistant.statusobj.SC_is_dm) {
		e.data.thisAssistant.enableFavButton(true);
	}

	e.data.thisAssistant.setFavButtonState();
	
};

/**
 * @param {Boolean} [is_favorite] true or false. if not provided, gets value from this.statusobj
 */
MessageDetailAssistant.prototype.setFavButtonState = function(is_favorite) {
	
	if (this.statusobj && !this.statusobj.SC_is_dm) {
		
		if (is_favorite !== true && is_favorite !== false) {
			is_favorite = this.statusobj.favorited;
		}
		
		var menu_item = this.cmdMenuModel.items[1].items[2];

		Mojo.Log.error('menu_item: %j', menu_item);
		Mojo.Log.error('is_favorite: %s', is_favorite);
			
		if (is_favorite) {
			menu_item.iconPath = 'images/theme/menu-icon-favorite.png';
			this.controller.modelChanged(this.cmdMenuModel);
		} else {
			menu_item.iconPath = 'images/theme/menu-icon-favorite-outline.png';
			this.controller.modelChanged(this.cmdMenuModel);
		}
		
	}
};


MessageDetailAssistant.prototype.enableFavButton = function(enabled) {
	
	if (enabled) {
		this.cmdMenuModel.items[1].items[2].disabled = false;
		this.controller.modelChanged(this.cmdMenuModel);
	} else {
		this.cmdMenuModel.items[1].items[2].disabled = true;
		this.controller.modelChanged(this.cmdMenuModel);
	}
	
};



MessageDetailAssistant.prototype.enableDeleteButton = function(enabled) {
	
	if (enabled) {
		this.cmdMenuModel.items[1].items[3].disabled = false;
		this.controller.modelChanged(this.cmdMenuModel);
	} else {
		this.cmdMenuModel.items[1].items[3].disabled = true;
		this.controller.modelChanged(this.cmdMenuModel);
	}
	
};
