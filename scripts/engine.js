// engine.js
"use strict";
// if game exists use the existing copy
// else create a new object literal
var game = game || {};

game.engine = (function(){
	console.log("loaded engine.js module");
	
	/* VARIABLES */
	// SCREEN AND AUDIO VARIABLES
	var windowManager = game.windowManager; // reference to the engine's window manager
	var bgAudio;				// audio player reference for background audio
	var sfxPlayer;				// audio player reference for sound effects
	var canvas,ctx;				// canvas references
	var mouseX, mouseY;			// mouse coordinates
	var animationID;			// stores animation ID of animation frame
	var paused = false;			// if the game is paused
	var mouseDown = false;		// if the mouse is being held down
	var uiClicked = false;		// if UI was clicked
	var mouse = {};				// the mouse object
	var lastTime = (+new Date); // used with calculateDeltaTime
	var dt = 0;					// delta time
	var time = 0;
	
	// ASSETS
	var background = new Image();
	var baseImg = new Image();
	var lavaImg = new Image();
	
	// GAME VARIABLES
	// General
	var globalGameSpeed;		// current speed of the game, mainly used for faster terrain
	var GAME_STATE = {			// "enum" of the current status of the game
		START: 0,				// start screen
		RUNNING: 1,				// players are alive and running
		SWITCHING: 2,			// players are swapping positions
		BETWEEN: 3,				// between levels on the buy screen
		DEAD: 4,				// entire party is dead
		HIGHSCORE: 5			// viewing the high score table
	};
	var currentGameState = GAME_STATE.START; // what is currently happening in the game
	var currentLevel = 0;		// what level the player is on
	var currentLevelLength = 0;	// how long this level is (how many terrains will spawn)
	var keys = [];				// array to store pressed keys
	var experience = 0;			// increases like score, but can be spent for upgrades
	var score = 0;				// current score, = number of terrain objects passed
	var highScores = [];		// array of high scores when they're loaded in
	// Terrain
	var currentTerrainType;		// current type of floor object being generated
	var terrainCount;			// number of terrain type to be generated before switching
	var TERRAIN_WIDTH = 100;	// width of each terrain object, think of it like "block width"
	var TERRAIN_HEIGHT = 100;	// height of each terrain object, how high from the bottom it goes
	var terrains = [];			// array to hold terrain objects
	var TERRAIN_TYPES = {		// "enum" of terrain types
		BASE: {
			isSolid: true,
			img: new Image()
		},
		VOID: {
			isSolid: false,
			img: new Image()
		},
		LAVA: {
			isSolid: false,
			img: new Image()
		},
		randomDangerous: function() {
			if (Math.random() < 0.5)
				return TERRAIN_TYPES.VOID;
			return TERRAIN_TYPES.LAVA;
		}
	};
	// Players
	var players = [];			// array that holds all 3 players
	var paladin = {};			// direct reference to the paladin
	var ranger = {};			// direct reference to the ranger
	var magi = {};				// direct reference to the magi
	// Player classes
	var PLAYER_CLASSES = {		// enum storing class info
		PALADIN: {
			name: "Paladin",
			health: 125,
			img: new Image(),
			width: 65,
			height: 150,
			qDur: 300,
			qCool: 350,
			qSnd: "shield.wav",
			wDur: 24,
			wCool: 350,
			wSnd: "arrow.wav"
		},
		RANGER: {
			name: "Ranger",
			health: 75,
			img: new Image(),
			width: 65,
			height: 145,
			qDur: 0,
			qCool: 5,
			qSnd: "arrow.wav",
			wDur: 0,
			wCool: 300,
			wSnd: "run.wav"
		},
		MAGI: {
			name: "Magi",
			health: 100,
			img: new Image(),
			width: 65,
			height: 130,
			qDur: 0,
			qCool: 30,
			qSnd: "fireball.wav",
			wDur: 200,
			wCool: 650,
			wSnd: "iceBridge.wav"
		}
	};
	// Enemies
	var enemies = [];
	var ENEMY_TYPES = {
		GATOR: {
			name: "GATOR",
			health: 75,
			img: new Image(),
			width: 100,
			height: 60,
			AI: "running"
		},
		RAT: {
			name: "Rat",
			health: 55,
			img: new Image(),
			width: 100,
			height: 50,
			AI: "standing"
		},
		BAT: {
			name: "Bat",
			health: 50,
			img: new Image(),
			width: 85,
			height: 50,
			AI: "flying"
		}
	};
	// Projectiles
	var projectiles = [];
	var PROJECTILE_TYPES = {
		ARROW: {
			strength: function() { return 3 + ranger.abilities.Q.level; },
			img: new Image(),
			width: 45,
			height: 13,
			gravity: true,
			velocity: 2
		},
		FIREBALL: {
			strength: function() { return Math.min(8, 1 + currentLevel); },
			img: new Image(),
			width: 40,
			height: 40,
			gravity: false,
			velocity: -30
		},
		MAGIFIREBALL: {
			strength: function() { return 5 + magi.abilities.Q.level*1.5;},
			img: new Image(),
			width: 40,
			height: 40,
			gravity: false,
			velocity: -20
		}
	};
	// Particle Systems
	var particleSystems = [];
	var particles = [];
	var PARTICLE_TYPES = {		// enum storing particle type info
		FLAME: {
			collidesTerrain: false,
			gravity: false,
			vel: function() { return new Victor(rand(-1, 1), rand(-1, 1)); },
			img: new Image()
		},
		ICE: {
			collidesTerrain: true,
			gravity: true,
			vel: function() { return new Victor(rand(10, 30), rand(-10, -30)); },
			img: new Image()
		},
		FROST: {
			collidesTerrain: false,
			gravity: false,
			vel: function() { return new Victor(-globalGameSpeed + rand(-0.5, 0.5), rand(-0.5, 0.5)); },
			img: new Image()
		}
	}
	
	// PHYSICS VARIABLES
	var GRAVITY = 60;			// global gravity - this*dt added to velocity.y
	var jumpFunction = function() { return 1000/60*TERRAIN_WIDTH/globalGameSpeed; };
	var globalLastTerrain = {};
	var newUI = undefined;
	var inControl = function() { return currentGameState === GAME_STATE.RUNNING || currentGameState === GAME_STATE.SWITCHING; };
	
	
	// Set up canvas and game variables
	function init() {
		// SETUP: canvas and audio
		// canvas
		canvas = document.querySelector('canvas');
		ctx = canvas.getContext("2d")
		
		// get reference to audio element
		bgAudio = document.querySelector('#bgAudio');
		
		// load default song and title, and play
		//playStream(sfxPlayer);
		loadAssets();
		
		// taps working as jumps 
		canvas.addEventListener("mousedown", function(e) {
			mouseDown = true;
			e.preventDefault();
			
			// check for mouse presses on the UI
			uiClicked = game.windowManager.checkMouse(e);
			
			// run game actions if the UI was not clicked
			if(!uiClicked){
				// Switch party order on clicks
				// loop and cycle if they aren't running already
				if (currentGameState === GAME_STATE.RUNNING) {
					for (var i = 0; i < players.length; ++i) {
						// only cycle living players
						if (players[i].deathTime == 0) {
							// left click - cycle left
							if (e.which == 1)
								players[i].cycleOrder(1);
							// right click - cycle right
							if (e.which == 3)
								players[i].cycleOrder(-1);
						}
					};
					
					// players are now switching positions
					currentGameState = GAME_STATE.SWITCHING;
				};
				
				// if the player has died
				if (currentGameState === GAME_STATE.DEAD) {
					// restart the game
					setupGame();
				};
			}
		}.bind(this));
		// compatibility for touch devices
		canvas.addEventListener("touchstart", function(e) { 
			mouseDown = true;
			e.preventDefault();
			
			// check for mouse presses on the UI
			uiClicked = game.windowManager.checkMouse(e);
			
			// run game actions if the UI was not clicked
			if(!uiClicked){
				// if the game is running (player is alive)
				if (currentGameState == GAME_STATE.RUNNING) {
					for (var i = 0; i < players.length; ++i) {
						// loop players and jump after a delay based on party order
						setTimeout(players[i].jump, i*jumpFunction(), 15, 1);
					};
				};
				// if the player has died
				if (currentGameState == GAME_STATE.DEAD) {
					// restart the game
					setupGame();
				};
			}
		}.bind(this));
		// track mouse position
		canvas.addEventListener("mousemove", function(e) { mouse = getMouse(e) });
		// taps working as jumps
		canvas.addEventListener("mouseup", function(e) { mouseDown = false; });
		canvas.addEventListener("touchend", function(e) { mouseDown = false; });
		
		// callback for button presses
		window.addEventListener("keydown", keyPress);
		// callback for button presses
		window.addEventListener("keyup", keyRelease);
		
		//== Register Ability UI ==//
		// HUD box for current abilities
		windowManager.makeUI("abilityHUD", 0, canvas.height*7/8, canvas.width/6, canvas.height/8);
		// set ability box to sandstone colors
		windowManager.modifyUI("abilityHUD", "fill", {color: "#ddce8f"});
		windowManager.modifyUI("abilityHUD", "border", {color: "#b7a86d", width: 3});
		windowManager.toggleUI("abilityHUD");
		// ability buttons
		windowManager.makeButton("abilityHUD", "ability1", 10, 10, canvas.width/12 - 15, canvas.height/8 - 20, function(){game.engine.keyPress({keyCode: KEY.Q});});
		windowManager.modifyButton("abilityHUD", "ability1", "fill", {color: "#30d0ff"});
		windowManager.modifyButton("abilityHUD", "ability1", "border", {color: "#0b85a8", width: 2});
		windowManager.modifyButton("abilityHUD", "ability1", "text", {string: "Ability 1", css: "12pt 'Uncial Antiqua'", color: "#0b85a8"});
		windowManager.toggleButton("abilityHUD", "ability1");
		windowManager.makeButton("abilityHUD", "ability2", canvas.width/12 + 5, 10, canvas.width/12 - 15, canvas.height/8 - 20, function() {game.engine.keyPress({keyCode: KEY.W});});
		windowManager.modifyButton("abilityHUD", "ability2", "fill", {color: "#30d0ff"});
		windowManager.modifyButton("abilityHUD", "ability2", "border", {color: "#0b85a8", width: 2});
		windowManager.modifyButton("abilityHUD", "ability2", "text", {string: "Ability 2", css: "12pt 'Uncial Antiqua'", color: "#0b85a8"});
		windowManager.toggleButton("abilityHUD", "ability2");
		//windowManager.makeButton("abilityHUD", "ability3", canvas.width/6, 10, canvas.width/12 - 15, canvas.height/8 - 20, function(eKey){game.engine.keyPress({keyCode: KEY.E});});
		//windowManager.modifyButton("abilityHUD", "ability3", "fill", {color: "#30d0ff"});
		//windowManager.modifyButton("abilityHUD", "ability3", "border", {color: "#0b85a8", width: 2});
		//windowManager.modifyButton("abilityHUD", "ability3", "text", {string: "Ability 3", css: "12pt 'Uncial Antiqua'", color: "#0b85a8"});
		//windowManager.toggleButton("abilityHUD", "ability3");
		
		// score HUD
		windowManager.makeUI("scoreHUD", canvas.width-150, 0, 150, 50);
		// set fill to gradient
		var grad = ctx.createLinearGradient(0, 0, 150, 0);
		grad.addColorStop(0, "rgba(0, 0, 0, 0)");
		grad.addColorStop(1, "rgba(0, 0, 0, 0.5)");
		windowManager.modifyUI("scoreHUD", "fill", {color: grad});
		windowManager.toggleUI("scoreHUD");
		// score text
		windowManager.makeText("scoreHUD", "score", 10, 10, 130, 30, "Score: %v", "20pt Calibri", "white");
		windowManager.toggleText("scoreHUD", "score");
		
		//== Register Between-level Upgrade Shop UI ==//
		// black background for shop window
		windowManager.makeUI("shopHUD", 0, 0, canvas.width, canvas.height);
		windowManager.modifyUI("shopHUD", "fill", {color: "rgba(0, 0, 0, 0.65)"});
		// main box that makes up shop window
		windowManager.makeButton("shopHUD", "mainPanel", canvas.width/8, canvas.height/8, canvas.width*.75, canvas.height*.75, undefined);
		windowManager.modifyButton("shopHUD", "mainPanel", "fill", {color: "#ddce8f"});
		windowManager.modifyButton("shopHUD", "mainPanel", "border", {color: "#b7a86d", width: 4});
		windowManager.toggleButton("shopHUD", "mainPanel");
		// 'next level' button
		windowManager.makeButton("shopHUD", "nextLevel", canvas.width*7/8 - 120, canvas.height/8 + 5, 115, 50, game.engine.setupLevel);
		windowManager.modifyButton("shopHUD", "nextLevel", "fill", {color: "#30d0ff"});
		windowManager.modifyButton("shopHUD", "nextLevel", "border", {color: "#0b85a8", width: 2});
		windowManager.modifyButton("shopHUD", "nextLevel", "text", {string: "Next Level", css: "12pt 'Uncial Antiqua'", color: "#0b85a8"});
		windowManager.toggleButton("shopHUD", "nextLevel");
		//== Player ability upgrades ==//
		// Paladin Q
		//windowManager.makeButton("shopHUD", "paladinQ", 1.5*canvas.width/8, 3*canvas.height/8, 160, 50, function() {console.log(game.engine);});
		//windowManager.modifyButton("shopHUD", "paladinQ", "fill", {color: "#30d0ff"});
		//windowManager.modifyButton("shopHUD", "paladinQ", "border", {color: "#0b85a8", width: 2});
		//windowManager.modifyButton("shopHUD", "paladinQ", "text", {string: "+Shield Duration", css: "12pt 'Uncial Antiqua'", color: "#0b85a8"});
		//windowManager.toggleButton("shopHUD", "paladinQ");	
		// Paladin W
		//windowManager.makeButton("shopHUD", "paladinW", 1.5*canvas.width/8, 3*canvas.height/8, 160, 50, function() {game.engine.paladin.abilities.W.levelUp();});
		//windowManager.modifyButton("shopHUD", "paladinW", "fill", {color: "#30d0ff"});
		//windowManager.modifyButton("shopHUD", "paladinW", "border", {color: "#0b85a8", width: 2});
		//windowManager.modifyButton("shopHUD", "paladinW", "text", {string: "+Dash Speed", css: "12pt 'Uncial Antiqua'", color: "#0b85a8"});
		//windowManager.toggleButton("shopHUD", "paladinW");	
		
		// BEGIN main game tick
		update();
	};
	
	// Setup a new game
	function setupGame() {
		// reset variables
		score = 0;
		currentLevel = 0;
		currentGameState = GAME_STATE.RUNNING;
		
		// SETUP: game
		// create the players
		players[0] = paladin = new Player(PLAYER_CLASSES.PALADIN);
		players[1] = ranger = new Player(PLAYER_CLASSES.RANGER);
		players[2] = magi = new Player(PLAYER_CLASSES.MAGI);
		
		// prepare the level
		setupLevel();
		
		// start music loop
		bgAudio.play();
	};
	
	// Setup the next level
	function setupLevel() {
		// level number and properties
		++currentLevel;
		currentLevelLength = 75 + currentLevel*25;
		
		//== Reset entities ==//
		particles = [];
		particleSystems = [];
		projectiles = [];
		
		//== Prepare Terrain ==//
		// reset terrains
		terrains = [];
		globalGameSpeed = Math.min(16, 7+currentLevel);
		
		// generate initial terrain
		currentTerrainType = TERRAIN_TYPES.BASE;
		for (var i = 0; i < Math.floor(canvas.width*1.5/TERRAIN_WIDTH); ++i) {
			terrains[i] = new Terrain(i*TERRAIN_WIDTH);
		}
		
		// set up first dangerous tiles
		currentTerrainType = TERRAIN_TYPES.randomDangerous();
		terrainCount = 2;
		
		//== Starting Enemy ==//
		enemies[0] = new Enemy(ENEMY_TYPES.GATOR);
		
		// Disable HUD and begin running!
		windowManager.deactivate("shopHUD");
		currentGameState = GAME_STATE.RUNNING;
	};
	
	// Load game assets (images and sounds)
	function loadAssets() {
		background.src = "assets/Wall720.png";
		TERRAIN_TYPES.BASE.img.src = "assets/TileSandstone100.png";
		TERRAIN_TYPES.LAVA.img.src = "assets/lava.png";
		
		PLAYER_CLASSES.PALADIN.img.src = "assets/paladinRun.png";
		PLAYER_CLASSES.RANGER.img.src = "assets/rangerRun.png";
		PLAYER_CLASSES.MAGI.img.src = "assets/magiRun.png";
		
		ENEMY_TYPES.RAT.img.src = "assets/ratRun.png";
		ENEMY_TYPES.BAT.img.src = "assets/batRun.png";
		ENEMY_TYPES.GATOR.img.src = "assets/gatorRun.png";
		
		PROJECTILE_TYPES.ARROW.img.src = "assets/arrow.png";
		PROJECTILE_TYPES.FIREBALL.img.src = PROJECTILE_TYPES.MAGIFIREBALL.img.src = "assets/fireball.png";
		
		PARTICLE_TYPES.FLAME.img.src = "assets/flameParticle.png";
		PARTICLE_TYPES.ICE.img.src = PARTICLE_TYPES.FROST.img.src = "assets/iceParticle.png";
	};
	
	// play a sound effect
	function playStream(source, vol) {
		var player = new Audio("assets/" + source);
		player.volume = vol;
		player.play();
	};
	
	// main game tick
	function update() {
		// scedule next draw frame
		animationID = requestAnimationFrame(update);
		dt = calculateDeltaTime();
		++time;
		
		// start game if on start screen and space or start is being pressed
		if (currentGameState === GAME_STATE.START) {
			if (keys[KEY.SPACE] || mouseDown) {
				setupGame();
			}
			else {
				ctx.fillStyle = "rgb(20, 20, 20)";
				ctx.fillRect(0, 0, canvas.width, canvas.height);
				ctx.fill();
				fillText(ctx, "Welcome to Leap of Faith", canvas.width/2, canvas.height/2-100, "30pt 'Uncial Antiqua'", "white");
				fillText(ctx, "Left and right click or arrows to cycle party members left or right", canvas.width/2, canvas.height/2-50, "20pt Calibri", "white");
				fillText(ctx, "Press space to jump. You can double jump.", canvas.width/2, canvas.height/2-20, "20pt Calibri", "white");
				fillText(ctx, "Press Q or W to activate the party leader's primary/secondary abilities", canvas.width/2, canvas.height/2+10, "20pt Calibri", "white");
				fillText(ctx, "Party members respawn after a delay, and they regen health slowly", canvas.width/2, canvas.height/2+40, "20pt Calibri", "white");
				fillText(ctx, "Get points from surviving and killing enemies", canvas.width/2, canvas.height/2+70, "20pt Calibri", "white");
				fillText(ctx, "(The enemies are the boxes with pro jumping and flying skills)", canvas.width/2, canvas.height/2+95, "12pt Calibri", "white");
				fillText(ctx, "Press H to view high scores", canvas.width/2, canvas.height/2+140, "20pt Calibri", "white");
				fillText(ctx, "Press space to start", canvas.width/2, canvas.height/2+170, "20pt Calibri", "white");
				fillText(ctx, "Have fun.", canvas.width/2, canvas.height/2+200, "20pt Calibri", "white");
				fillText(ctx, "Code: Jake Ben-Tovim and Joe Kapusta, Art: Michelle Leadley, Design & Audio: Austin White", canvas.width/2, canvas.height-20, "10pt Calibri", "white");
			}
			return;
		}
		
		// draw high score screen
		if (currentGameState === GAME_STATE.HIGHSCORE) {
			ctx.fillStyle = "rgb(20, 20, 20)";
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.fill();
			fillText(ctx, "High Scores", canvas.width/2, 100, "30pt 'Uncial Antiqua'", "white");
			fillText(ctx, "Press H to return to the main menu", canvas.width/2, 135, "18pt Calibri", "white");
			
			// only draw high scores if localStorage is available
			if (typeof(window.localStorage) != undefined) {
				// loop through scores
				for (var i = 0; i < 10; ++i)
					// draw 0 in place of null scores
					if (highScores[i] == "null")
						fillText(ctx, (i+1) + ". 0", canvas.width/2, 200 + i*40, "20pt Calibri", "white");
					else
						fillText(ctx, (i+1) + ". " + highScores[i], canvas.width/2, 200 + i*40, "20pt Calibri", "white");
			}
			// otherwise, draw an error message
			else {
				fillText(ctx, "Your system does not support high score storage", canvas.width/2, canvas.height/2, "18pt Calibri", "white");
			}
			return;
		};
	 	
	 	// if paused, bail out of loop
		if (paused && currentGameState === GAME_STATE.RUNNING) {
			return;
		}
		
		// push to between screen if the level is finished
		if (currentLevelLength <= 0 && currentGameState != GAME_STATE.BETWEEN) {
			// check if there's any dangerous terrains left on screen
			var stillDangerous = false;
			for (var i = 0; i < terrains.length; ++i)
				if (terrains[i].terrainType != TERRAIN_TYPES.BASE) {
					stillDangerous = true;
					break;
				}
			
			// only go to between level state once the dangerous has passed
			if (!stillDangerous) {
				// set to between state
				currentGameState = GAME_STATE.BETWEEN;
				
				// enable upgrade screen UI
				windowManager.toggleUI("shopHUD");
				
				// reset player abilities
				for (var i = 0; i < players.length; ++i)
					players[i].abilities.reset();
			}
		}
		
		// if there are no players left, end the game
		if (players.length == 0)
			currentGameState = GAME_STATE.DEAD;
		
		// Switch party order with left or right arrow keys
		// loop and cycle if they aren't switching already
		if (currentGameState === GAME_STATE.RUNNING) {
			for (var i = 0; i < players.length; ++i) {
				// only cycle living players
				if (players[i].deathTime == 0) {
					// left click - cycle left
					if (keys[KEY.LEFT]) {
						players[i].cycleOrder(1);
						currentGameState = GAME_STATE.SWITCHING;
					}
					// right click - cycle right
					else
					if (keys[KEY.RIGHT]) {
						players[i].cycleOrder(-1);			
						// players are now switching positions
						currentGameState = GAME_STATE.SWITCHING;
					}
				}
			};
		};
		
		// clear the screen
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		
		// draw the parallax background
		for (var i = -(time*3 % 500); i < canvas.width; i += 500) {
			ctx.drawImage(background, i, 0);
		}
		
		// update players
		var numDead = 0;
		for (var i = 0; i < players.length; ++i) {
			// if player is alive, attempt an update
			if (players[i].deathTime == 0) {
				// only actually update if player is in control or they're off the ground
				// we also update if they're off the ground so they don't freeze midair between levels
				if (inControl() || !players[i].onGround)
					players[i].update();
				// otherwise, just do the draw
				else
					players[i].draw();
			}
				
			// if they're dead, increment death counter and respawn if it's been long enough
			else {
				++numDead;
				++players[i].deathTime;
				// respawn
				if (players[i].deathTime >= 1200) {
					// get number of living players
					var numAlive = 0;
					for (var ii = 0; ii < players.length; ++ii)
						if (players[ii].deathTime == 0)
							++numAlive;
							
					players[i].deathTime = -300;
					players[i].health = players[i].maxHealth/2;
					players[i].order = numAlive;
					players[i].setPosition(-275 - players[i].order, 0);
				}
			}
		};
		
		// if everyone is dead, send game to death screen
		if (numDead === players.length && currentGameState != GAME_STATE.DEAD) {
			players = [];
			currentGameState = GAME_STATE.DEAD;
			
			// attempt to add the score to the high score list
			if (typeof(window.localStore) != undefined) {
				// loop through stored scores
				for (var i = 0; i < 10; ++i) {
					// get the stored score
					var value = window.localStorage.getItem("score"+i);
					
					// if no score is there yet, put this one there
					if (value === null) {
						window.localStorage.setItem("score"+i, score);
						return;
					}
					
					// if this score is higher than that one, put this one in and push the rest down
					if (score > value) {
						// push rest down
						for (var ii = 9; ii > i; --ii) {
							window.localStorage.setItem("score"+ii, window.localStorage.getItem("score"+(ii-1)));
						}
						// put this one here
						window.localStorage.setItem("score"+i, score);
						return;
					}
				}
			}
		}
		
		// add an enemy if there isn't one
		if (enemies.length === 0) {
			switch(Math.round(rand(0, 2))) {
				case 0: enemies.push(new Enemy(ENEMY_TYPES.GATOR));
					break;
				case 1: enemies.push(new Enemy(ENEMY_TYPES.RAT));
					break;
				default: enemies.push(new Enemy(ENEMY_TYPES.BAT));
					break;
			}
		}
		
		// update enemies
		for (var i = 0; i < enemies.length; ++i) {
			// only actually update enemies if player is in control
			if (inControl())
				enemies[i].update();
			// otherwise, just do the draw
			else
				enemies[i].draw();
		};
		
		// update projectiles
		for (var i = 0; i < projectiles.length; ++i) {
			projectiles[i].update();
		};
		
		// update & draw terrain objects
		for (var i = 0; i < terrains.length; ++i) {
			// update it
			terrains[i].update();
			
			// get currently looped terrain object
			var currentTerrain = terrains[i];
			
			// delete the object if it has gone off screen a bit
			if (currentTerrain.position.x < -TERRAIN_WIDTH*2) {
				terrains.splice(i, 1);
				
				// in/decrement game variables if the game is running
				if (currentGameState == GAME_STATE.RUNNING || currentGameState == GAME_STATE.SWITCHING) {
					++score;
					++experience;
					--currentLevelLength;
				}
			}
		}
		
		// attempt to create new terrain objects if last one is fully on screen
		// get position of last terrain object's edge
		var lastX = terrains[terrains.length-1].position.x+TERRAIN_WIDTH;
		// if the last 
		if (lastX < canvas.width) {
			terrains[terrains.length] = new Terrain(lastX);	// create a new terrain at the edge of the last one
			--terrainCount;	// subtract from the number of terrains of current type to make
			
			// check if we've reached the end of this terrain type
			if (terrainCount <= 0) {
				// force base ground to generate after each other terrain type or at the end of the level
				if (currentTerrainType != TERRAIN_TYPES.BASE || currentLevelLength <= 0) {
					currentTerrainType = TERRAIN_TYPES.BASE;
					// ground patches get shorter as game speeds up
					terrainCount = Math.max(3, Math.round(15 - globalGameSpeed*.75));
				}
				// otherwise, generate another "danger terrain"
				else {
					// terrain type becomes random danger
					currentTerrainType = TERRAIN_TYPES.randomDangerous();
					
					// danger patches get larger as game speeds up
					terrainCount = Math.min(5, Math.floor(Math.random()*globalGameSpeed/5) + 2);
				}
			}
		};
		
		// update particle systems
		for (var i = 0; i < particleSystems.length; ++i)
			particleSystems[i].update();
		// update all particles
		for (var i = 0; i < particles.length; ++i)
			particles[i].update();
		
		// draw HUDs
		if (currentGameState != GAME_STATE.DEAD) {
			game.windowManager.updateAndDraw([{name:"score", value:[score]}]);
			
			// draw score in upper right
			//var grad = ctx.createLinearGradient(0, 0, 150, 0);
			//grad.addColorStop(0, "rgba(0, 0, 0, 0)");
			//grad.addColorStop(1, "rgba(0, 0, 0, 0.5)");
			//ctx.fillStyle = grad;
			//ctx.fillRect(canvas.width-150, 0, 150, 50);
			//fillText(ctx, "Score: " + score, canvas.width - 75, 25, "20pt Calibri", "white");
			//ctx.fill();
		}
		// draw death screen if player has died
		else {
			ctx.save();
			ctx.fillStyle = "black";
			ctx.globalAlpha = 0.7;
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.fill();
			fillText(ctx, "You died.", canvas.width/2, canvas.height/2 - 40, "30pt 'Uncial Antiqua'", "white");
			fillText(ctx, "Score: " + score, canvas.width/2, canvas.height/2, "24pt Calibri", "white");
			fillText(ctx, "Press H to view high scores", canvas.width/2, canvas.height/2 + 40, "24pt Calibri", "white");
			fillText(ctx, "Press space to restart", canvas.width/2, canvas.height/2 + 80, "24pt Calibri", "white");
			ctx.restore();
		};
	};
	
	// BASE CLASS: game object with physics and bounding box variables
	function GameObject() {
		// starting position of game object
		this.position = new Victor();
		// bounding box width and height for game object
		this.bounds = new Victor();
		// offset to draw the object's image at, changes it's "point of rotation" in a sense
		this.offset = new Victor();
		
		// MUTATOR: force object's position, within bounds of canvas
		this.setPosition = function(x, y) {
			this.position.x = clamp(x, 0, canvas.width);
			this.position.y = clamp(y, 0, canvas.height);
		};

		// HELPER: returns a vector from the center of this game object
		// to the center of the given game object
		this.vecToOther = function(other) {
			// if either object has no bounds, use 0 size bounding box
			var mBounds = (this.bounds != undefined ? this.bounds : Victor());
			var oBounds = (other.bounds != undefined ? other.bounds : Victor());
			return other.position.clone().add(oBounds.clone().divide(Victor(2, 2))).subtract(this.position.clone().add(mBounds.clone().divide(Victor(2, 2))));
		};
		
		// HELPER: returns whether this object overlaps another
		this.overlaps = function(other) {
			return (other.position.y + other.bounds.y > this.position.y && other.position.y < this.position.y + this.bounds.y
				 && other.position.x + other.bounds.x > this.position.x && other.position.x < this.position.x + this.bounds.x);
		}
	};
	
	// BASE CLASS: game object that can move
	function MobileObject() {
		GameObject.call(this);
	
		// starting velocity of game object
		this.velocity = new Victor();
		this.numJumps = 0;		// number of jumps the object has done in current sequence
		this.maxJumps = 2;		// max number of jumps the object can do in sequence
		this.onGround = true;	// whether the object is currently grounded
		this.maxHealth = 0; 	// this object's max health
		this.health = 0; 		// this object's current health
		this.fireTicks = 0;		// amount of ticks left while this is on fire
		
		// MUTATOR: force object's velocity
		this.setVelocity = function(x, y) {
			this.velocity = new Victor(x, y);
		};
		
		// HELPER: damage the object
		this.damage = function(strength) {
			this.health -= strength;
		};
		
		// FUNCTION: force a jump
		this.jump = function(speed, startingPush, force) {
			// first check if they're on the ground
			if (this.numJumps < this.maxJumps || force) {
				// don't increment number of jumps if it's a forced jump
				if (!force)
					++this.numJumps;
				
				// give the initial thrust
				this.velocity.y = -speed;
				this.position.y -= startingPush;
				this.onGround = false;
				// force animation to run a bit
				++this.time;
			};}.bind(this);
	};
	
	// CLASS: terrain object
	function Terrain(startX) {
		GameObject.call(this);
		
		/* VARIABLES */
		// terrain bounds
		this.bounds = new Victor(
			TERRAIN_WIDTH,
			TERRAIN_HEIGHT
		);
		// starting terrain position
		this.position = new Victor(
			startX,
			canvas.height-this.bounds.y
		);
		// terrain's type is global type at time of its spawn 
		this.terrainType = currentTerrainType;
		// if the terrain has been iced by the wizard's spell - acts as solid
		this.iced = false;
		
		// check if the magi ice bridge is active, and if so, freeze this terrain
		if (magi != {})
			if (magi.abilities.W.duration > 0 && magi.deathTime == 0) {
				this.iced = true;
				particleSystems.push(new ParticleSystem(this, PARTICLE_TYPES.FROST, -1, 120, 0.15));
			}
		
		// FUNCTION: returns if the terrain is solid
		this.isSolid = function() {
			return this.terrainType.isSolid || this.iced;
		}
		
		// FUNCTION: update terrain position, draw it
		this.update = function() {
			// slide terrain object left quicker if
			for (var i = 0; i < 1 + paladin.abilities.W.duration/6; ++i)
				this.position.x -= globalGameSpeed;
			
			// try to push players
			for (var i = 0; i < players.length; ++i) {
				// first, check player is alive
				if (players[i].deathTime == 0)
					// if the player overlaps the terrain
					if (players[i].overlaps(this)) {
						// if this terrain is solid...
						if (this.isSolid()) {
							// ...push the player against the terrain
							players[i].position.x = this.position.x - players[i].bounds.x;
						}
						
						// if it's lava, bounce the player and damage them
						if (this.terrainType === TERRAIN_TYPES.LAVA && players[i].position.y + players[i].bounds.y > this.position.y + this.bounds.y/10) {
							players[i].jump(15, 1, true); // forced jump
							players[i].numJumps = 0; // reset jumps so the forced jump doesn't kill them
							players[i].damage(10); // do some damage
						}
					};
			};
			
			// draw the terrain object
			ctx.save();
			
			if (this.terrainType != TERRAIN_TYPES.VOID)
				ctx.drawImage(this.terrainType.img, this.position.x, this.position.y);
			
			// check if it's been frozen by the wizard
			if (this.iced) {
				ctx.fillStyle = "rgba(0, 255, 255, 0.5)";
				ctx.fillRect(this.position.x, this.position.y, this.bounds.x, this.bounds.y);
				ctx.fill();
			}
			ctx.restore();
		};
	};
	
	// CLASS: player object
	function Player(classType) {
		MobileObject.call(this);
	
		/* VARIABLES */
		this.classType = classType;		// player's class - Paladin, Ranger, or Magi
		this.maxJumps = 2;				// max number of jumps they can do in sequence
		this.order = players.length; 	// order in the party - defaults to last
		this.maxHealth = this.health = classType.health; // this player's health and max health
		this.deathTime = 0;
		this.bounds = new Victor(		// the player's bounding width and height
			this.classType.width,
			this.classType.height
		);
		this.position = new Victor(		// starting player position
			275 - players.length*100,
			canvas.height-TERRAIN_HEIGHT-this.bounds.y-250
		);
		this.abilities = {				// stores current cooldown on each skill
			Q: {
				duration: 0,
				cooldown: 0,
				level: 0,
				maxDur: this.classType.qDur,
				maxCool: this.classType.qCool,
				levelUp: function() {
					console.log(this);
				}
			},
			W: {
				duration: 0,
				cooldown: 0,
				level: 0,
				maxDur: this.classType.wDur,
				maxCool: this.classType.wCool
			},
			E: {
				duration: 0,
				cooldown: 0,
				level: 0,
				maxDur: this.classType.wDur,
				maxCool: this.classType.wCool
			},
			decrement: function() {
				this.Q.duration = Math.max(0, this.Q.duration-1);
				this.W.duration = Math.max(0, this.W.duration-1);
				this.E.duration = Math.max(0, this.E.duration-1);
				this.Q.cooldown = Math.max(0, this.Q.cooldown-1);
				this.W.cooldown = Math.max(0, this.W.cooldown-1);
				this.E.cooldown = Math.max(0, this.E.cooldown-1);
			},
			reset: function() {
				this.Q.duration = this.W.duration = this.E.duration =
				this.Q.cooldown = this.W.cooldown = this.E.cooldown = 0;
			}
		};
		this.time = this.order*20;		// used to control animation timing
		this.frameWidth = this.classType.img.width/28; // width of 1 frame from the spritesheet
		this.frameHeight = this.classType.img.height;  // height of 1 frame from the spritesheet
		this.offset = new Victor(this.frameWidth/-3, this.frameHeight/-8); // player's image offset
		
		// FUNCTION: cycle order by a number
		// can be negative to cycle right
		this.cycleOrder = function(num) {
			// get number of living players
			var numAlive = 0;
			for (var i = 0; i < players.length; ++i)
				if (players[i].deathTime == 0)
					++numAlive;
		
			this.order = (this.order + num < 0 ? numAlive + (this.order + num) : this.order + num) % numAlive;
		};
		
		// FUNCTION: prints player information to console
		this.toString = function() {
			console.log("Player in position " + this.order + " is at " + this.position.toString());
		};
		
		// FUNCTION: damage the player, does appropriate armor checks, etc
		this.damage = function(power) {
			if (this.deathTime >= 0)
				this.health -= power;
		};
		
		// FUNCTION: main player object tick
		this.update = function() {					
			// occasionally play running sfx
			if (this.onGround && time % 15 + this.order == 0)
				playStream("run.wav", 0.175);
		
			// if deathTime is below 0 (they are invulnerable), increase it
			if (this.deathTime < 0)
				++this.deathTime;
			
			// kill player if off screen or at 0 health
			if (this.position.y > canvas.height*2 || this.health <= 0) {
				// slide ones behind this one forward
				for (var i = 0; i < players.length; ++i) {
					if (players[i].order > this.order && players[i].deathTime == 0)
						--players[i].order;
				};
				
				// reset ability runtimes and cooldowns
				this.abilities.reset();
				
				// start this one's death counter
				++this.deathTime;
			};
			
			// regen some health and clamp health within 0 and max
			this.health = clamp(this.health + 0.02, 0, this.maxHealth);
			
			// decrement timing and ability variables
			this.abilities.decrement();
			
			// clamp order within player list
			this.order = clamp(this.order, 0, players.length-1);
			
			// try to move towards where it should be in the running order
			if (this.position.x != 275 - this.order*100) {
				// only try to move if its above the terrain level
				if (this.position.y + this.bounds.y <= canvas.height - TERRAIN_HEIGHT) {
					// if it's close, round off
					if (Math.abs(this.position.x - (275 - this.order*100)) <= 3) {
						this.position.x = 275 - this.order*100;
					}
					// otherwise, move towards where it should be
					else {
						this.position.x -= Math.sign(this.position.x - (275 - this.order*100))*5;
					};
				};
					
				// loop players and update game state if they're done switching
				if (currentGameState == GAME_STATE.SWITCHING) {
					var allSwitched = true;
					for (var i = 0; i < players.length; ++i)
						if (players[i].position.x != 275 - players[i].order*100 && players[i].deathTime == 0)
							allSwitched = false;
							
					if (allSwitched)
						currentGameState = GAME_STATE.RUNNING;
				};
			};
			
			// update onGround variable
			this.onGround = false;
			
			// update if they're on the ground
			// loop through terrain objects
			for (var i = 0; i < terrains.length; ++i) {
				// get currently looped terrain object
				var currentTerrain = terrains[i];
				
				// update onGround variable by comparing pos to each terrain object
				if (this.overlaps(currentTerrain) && currentTerrain.isSolid() && this.velocity.y >= 0) {
					this.onGround = true;
					break;
				}
			};
			
			// if off ground, update physics and check if on ground
			if (!this.onGround) {		
				// update phsyics
				this.velocity.y += GRAVITY*dt
					
				// loop through velocity
				for (var i = 0; i < Math.abs(this.velocity.y); ++i) {
					// distance to move this loop - 1 each pixel, or the decimal
					// remainder of velocity on the last loop
					var moveDist = (Math.abs(this.velocity.y) - i < 1 ? Math.abs(this.velocity.y) - i : 1) * Math.sign(this.velocity.y);
					
					// variable to store if its safe to move
					var positionSafe = true;
					
					// loop through terrain objects and check if we can move down
					for (var ii = 0; ii < terrains.length; ++ii) {
						// get currently looped terrain object
						var currentTerrain = terrains[ii];
						
						// check is position we'd move to is safe (above terrain)
						// terrain we're checking is below is
						if (this.position.x < currentTerrain.position.x + currentTerrain.bounds.x && this.position.x + this.bounds.x > currentTerrain.position.x) {
							// terrain below us is solid ground and we'd be inside it if we moved down
							if (this.position.y + this.bounds.y + moveDist > currentTerrain.position.y && currentTerrain.isSolid()) {
								// it's not safe to move
								positionSafe = false;
								break;
							};
						};
					};
					
					// if we're safe to move, shift down
					if (positionSafe || this.position.y + this.bounds.y > currentTerrain.position.y) {
						this.position.y += moveDist;
					}
					// otherwise, stick to the terrain
					else {
						this.velocity.y = 0;
						this.position.y = canvas.height - TERRAIN_HEIGHT - this.bounds.y;
						this.numJumps = 0;
						this.onGround = true;
						break;
					};
				}
			}
			else {
				this.velocity.y = 0;
				this.position.y = canvas.height - TERRAIN_HEIGHT - this.bounds.y;
				this.numJumps = 0;
			};
				
			// DRAW: draw the player
			this.draw();
		};
		
		// FUNCTION: main player draw call
		this.draw = function() {
			// increment timing for animation
			if (this.onGround)
				this.time = (this.time+0.75) % 28;
			else
				if (this.time != 0 && this.time != 13)
					this.time = Math.round(this.time+1) % 28;
					
			ctx.save();
			// draw the player's actual image from its spritesheet
			ctx.drawImage(this.classType.img, this.frameWidth*Math.floor(this.time), 0, this.frameWidth, this.frameHeight, this.position.x + this.offset.x, this.position.y + this.offset.y, this.frameWidth, this.frameHeight);
				
			// if the one drawing is the paladin, draw the shield if it's up
			if (this.classType == PLAYER_CLASSES.PALADIN && this.abilities.Q.duration > 0) {
				// prepare fill style
				ctx.fillStyle = "rgba(0, 255, 255, " + (this.abilities.Q.duration/100) + ")";
				
				// loop players
				for (var i = 0; i < players.length; ++i) {
					// draw shield in front of first player
					var p = players[i];
					if (p.order == 0 && players[i].deathTime == 0)
						ctx.fillRect(p.position.x + p.bounds.x, p.position.y + p.bounds.y - this.bounds.y*1.25, 25, this.bounds.y*1.25);
				}
				ctx.fill();
			}
			
			// draw health above head
			ctx.fillStyle = "red";
			ctx.fillRect(this.position.x+10, this.position.y - 14, this.bounds.x-20, 5);
			ctx.fillStyle = "green";
			ctx.fillRect(this.position.x+10, this.position.y - 14, (this.bounds.x-20) * (this.health/this.maxHealth), 5);
			
			// draw cooldown bars
			ctx.fillStyle = "rgb(0, 255, 255)";
			ctx.fillRect(this.position.x+10, this.position.y - 9, (this.bounds.x-20) * (this.abilities.Q.cooldown/this.abilities.Q.maxCool), 3);
			ctx.fillStyle = "rgb(0, 205, 205)";
			ctx.fillRect(this.position.x+10, this.position.y - 6, (this.bounds.x-20) * (this.abilities.W.cooldown/this.abilities.W.maxCool), 3);
			
			ctx.restore();
		};
			
		/* ATTACKING */
		// FUNCTION: 1st attack ('Q')
		this.baseAttack = function() {
			// if the player is in control and the ability is off cooldown, activate it
			if (this.abilities.Q.cooldown === 0 && inControl()) {
				// play the ability's sound effect
				playStream(this.classType.qSnd, 0.2);
				
				switch(this.classType) {
					case PLAYER_CLASSES.PALADIN:
						// activate the shield
						this.abilities.Q.duration = this.abilities.Q.maxDur;
						this.abilities.Q.cooldown = this.abilities.Q.maxCool;
						break;
					case PLAYER_CLASSES.RANGER:
						// shoot an arrow towards the first enemy
						projectiles.push(new Projectile(this.position.x+this.bounds.x/2, this.position.y+this.bounds.y/2, enemies[0], PROJECTILE_TYPES.ARROW, false));
						this.abilities.Q.duration = this.abilities.Q.maxDur;
						this.abilities.Q.cooldown = this.abilities.Q.maxCool;
						break;
					case PLAYER_CLASSES.MAGI:
						// shoot a fireball
						projectiles.push(new Projectile(this.position.x+this.bounds.x/2, this.position.y+this.bounds.y/2, enemies[0], PROJECTILE_TYPES.MAGIFIREBALL, false));
						this.abilities.Q.duration = this.abilities.Q.maxDur;
						this.abilities.Q.cooldown = this.abilities.Q.maxCool;
						break;
				};
			};
		};
		
		// FUNCTION: 2nd attack ('W')
		this.midAttack = function() {
			// if player is in control and the ability is off cooldown, activate it
			if (this.abilities.W.cooldown === 0 && inControl()) {
				// play the ability's sound effect
				playStream(this.classType.wSnd, 0.2);
				
				switch(this.classType) {
					case PLAYER_CLASSES.PALADIN:
						// dash forward
						this.abilities.W.duration = this.abilities.W.maxDur;
						this.abilities.W.cooldown = this.abilities.W.maxCool;
						break;
					case PLAYER_CLASSES.RANGER:
						// loop players and force a jump after a delay based on party order
						for (var i = 0; i < players.length; ++i) {
							// only schedule jumps for living players
							if (players[i].deathTime == 0) {
								setTimeout(players[i].jump, players[i].order*jumpFunction(), 15, 1, true);
							}
						};
						this.abilities.W.duration = this.abilities.W.maxDur;
						this.abilities.W.cooldown = this.abilities.W.maxCool;
						break;
					case PLAYER_CLASSES.MAGI:
						// ice over terrains
						if (this.position.y + this.bounds.y <= canvas.height - TERRAIN_HEIGHT) {
							for (var i = 0; i < terrains.length; ++i) {
								terrains[i].iced = true;
								particleSystems.push(new ParticleSystem(terrains[i], PARTICLE_TYPES.FROST, -1, 120, 0.15));
							}
							particleSystems.push(new ParticleSystem(this, PARTICLE_TYPES.ICE, 30, -1, 1));
							this.abilities.W.duration = this.abilities.W.maxDur;
							this.abilities.W.cooldown = this.abilities.W.maxCool;
						}
						break;
				};
			};
		};
	};
 
	// CLASS: projectile
	function Projectile(x, y, towards, projType, enemy) {
		MobileObject.call(this);
		
		// type of projectile
		this.projType = projType;
		this.enemyProj = enemy; // whether an enemy fired it (only hits players)
		this.speed = 30 - this.projType.velocity;
		this.gravity = this.projType.gravity;
		// the projectile's bounding box
		this.bounds = new Victor(
			this.projType.width,
			this.projType.height
		);
		// starting projectile position
		this.position = new Victor(
			x,
			y
		);
		// starting projectile velocity
		// directs itself towards the "towards" object passed in
		if (towards != undefined)
			if (towards.position != undefined)
				this.velocity = this.vecToOther(towards).divide(Victor(this.speed, this.speed));
			else
				this.velocity = Victor().subtract(this.position);
		else
			this.velocity = Victor().subtract(this.position);
			
		// attach a particle system based on its projectile type
		switch (this.projType) {
			case PROJECTILE_TYPES.FIREBALL:
			case PROJECTILE_TYPES.MAGIFIREBALL:
				this.system = new ParticleSystem(this, PARTICLE_TYPES.FLAME, -1, 10, 5);
				particleSystems.push(this.system);
				break;
		};
		
		// give an upwards thrust if it's affected by gravity
		if (this.gravity)
			this.velocity.y -= 15;
		
		// FUNCTION: main projectile object tick
		this.update = function() {		
			// kill player if off screen
			if (this.position.y > canvas.height*2 || this.position.x < 0 || this.position.x > canvas.width) {
				// delete this one
				projectiles.splice(projectiles.indexOf(this), 1);
				particleSystems.splice(particleSystems.indexOf(this.system), 1);
				return;
			};
			
			// whether the projectile has collided with something
			var collided = false;
			var victim = {}; // stores who/what the projectile hit
			
			// check for collisions
			// loop through terrain objects
			for (var i = 0; i < terrains.length; ++i) {
				// get currently looped terrain object
				var currT = terrains[i];
				
				// update onGround variable by comparing pos to each terrain object
				if (this.overlaps(currT) && currT.isSolid()) {
					collided = true;
					victim = currT;
					break;
				}
			};
			
			// find the first player
			var firstPlayer;
			if (players.length > 0)
				firstPlayer = players[0]; // variable where we will store front player
			else
				firstPlayer = {};
				
			// loop through players for collisions if it's an enemy projectile
			for (var i = 0; i < players.length; ++i) {
				// only check living players
				if (players[i].deathTime == 0) {
					// get currently looped terrain object
					var p = players[i];
					
					// store first player in running order
					if (p.order < firstPlayer.order && players[i].deathTime == 0)
						firstPlayer = p;
					
					// only check player collisions if it's an enemy projectile
					if (this.enemyProj)
						// update collided variable by comparing pos to each terrain object
						if (this.position.x < p.position.x + p.bounds.x && this.position.x + this.bounds.x > p.position.x) {
							if (this.position.y + this.bounds.y > p.position.y && this.position.y < p.position.y + p.bounds.y) {
								collided = true;
								victim = p;
								break;
							}
						}
				}
			};
			
			// loop through enemies if it's a non-enemy projectile
			if (!this.enemyProj)
			for (var i = 0; i < enemies.length; ++i) {
				// get currently looped terrain object
				var e = enemies[i];
				
				// update onGround variable by comparing pos to each terrain object
				if (this.position.x < e.position.x + e.bounds.x && this.position.x + this.bounds.x > e.position.x) {
					if (this.position.y + this.bounds.y > e.position.y && this.position.y < e.position.y + e.bounds.y) {
						collided = true;
						victim = e;
						break;
					}
				}
			};
			
			// check if it has hit the player's shield, and bounce if so
			if (this.enemyProj && firstPlayer != {})
				// thier shield is up
				if (paladin.abilities.Q.duration > 0 && paladin.deathTime == 0)
					// check for collisions with the shield box
					if (this.position.x < firstPlayer.position.x + firstPlayer.bounds.x + 25 && this.position.x + this.bounds.x > firstPlayer.position.x) {
						// overlap detected
						if (this.position.y + this.bounds.y > paladin.position.y-paladin.bounds.y*.25 && this.position.y < paladin.position.y + paladin.bounds.y) {
							// bounce
							this.velocity.x *= -1;
							// now is a player projectile
							this.enemyProj = false;
						}
					}
			
			// if off ground, update physics and check if on ground
			if (!collided) {		
				// update phsyics
				if (this.gravity)
					this.velocity.y += GRAVITY*dt
				this.position.x += this.velocity.x;
				this.position.y += this.velocity.y;
			}
			else {
				// only attempt to damage living objects
				if (!(victim instanceof Terrain)) {
					victim.damage(this.projType.strength());
					particleSystems.push(new ParticleSystem(victim, PARTICLE_TYPES.FLAME, 60, 30, 5));
				
					// if this is a magi fireball, ignite the enemy
					if (this.projType === PROJECTILE_TYPES.MAGIFIREBALL)
						victim.fireTicks = 60;
				}
			
				// delete this one
				particleSystems.splice(particleSystems.indexOf(this.system), 1);
				projectiles.splice(projectiles.indexOf(this), 1);
			};
				
			// DRAW: draw the projectile
			this.draw();
		};
	
		// FUCNTION: main projectile draw call
		this.draw = function() {
			ctx.save();
			ctx.drawImage(this.projType.img, this.position.x, this.position.y);
			ctx.restore();
		};
	};
	
	// CLASS: enemy object
	function Enemy(enemyType) {
		MobileObject.call(this);
		
		/* VARIABLES */
		this.enemyType = enemyType;		// what type of enemy this is
		this.maxJumps = 3;				// max number of jumps they can do in sequence
		this.time = 0; // controls sprite animation timing
		this.health = this.maxHealth = this.enemyType.health; // get health and max health of this enemy type
		this.bounds = new Victor(
			this.enemyType.width,
			this.enemyType.height
		);
		this.position = new Victor(		// starting enemy position
			canvas.width + this.bounds.x*1.5,
			canvas.height-TERRAIN_HEIGHT-this.bounds.y*2
		);
		this.frameWidth = this.enemyType.img.width/28; // width of 1 frame from the spritesheet
		this.frameHeight = this.enemyType.img.height;  // height of 1 frame from the spritesheet
		this.offset = new Victor(this.frameWidth/-4, this.frameHeight/-4); // enemys's image offset
		//if (this.enemyType != ENEMY_TYPES.RAT) this.offset.x = this.frameWidth/-4; // bat and gator images displays more to the left
		
		// set target differently depending on AI
		switch (this.enemyType.AI) {
			// if they're flying, they home to the top right
			case "flying":
				this.targetPos = new Victor(	// the location the enemy is homing towards
					canvas.width - this.bounds.x*1.5,
					this.bounds.y*1.5
				);
				break;
			// if it's a running enemy, they home to the right side
			default:
				this.targetPos = new Victor(	// the location the enemy is homing towards
					canvas.width - this.bounds.x*1.5,
					canvas.height-TERRAIN_HEIGHT-this.bounds.y
				);
				break;
		};
		
		// FUNCTION: prints enemy information to console
		this.toString = function() {
			console.log("Enemy " + this.enemyType + " is at x" + this.position.toString());
		};
		
		// FUNCTION: main enemy object tick
		this.update = function() {					
			// kill enemy if off screen or dead
			if (this.position.y > canvas.height*2 || this.health <= 0) {
				// award points equal to its starting health
				score += this.enemyType.health;
				experience += this.enemyType.health;
				
				// delete this one
				enemies.splice(enemies.indexOf(this), 1);
			};
			
			// bobbing for flying enemies
			if (this.enemyType.AI === "flying")
				this.position.y += Math.sin(time/10);
				
			// lose health from active DOTs
			if (this.fireTicks > 0) {
				--this.fireTicks;
				this.health -= 0.05;
			};
			
			// home towards target position
			if (this.targetPos != undefined) {
				// if it's close, snap to its homing position
				if (this.position.distanceSq(this.targetPos) <= 9) {
					this.position = this.targetPos;
					this.targetPos = undefined;
					this.velocity = new Victor();
				}
				// otherwise, velocity homes towards its target
				else {
					// if it's a flying enemy, it uses true homing
					if (this.enemyType.AI === "flying")
						this.velocity = this.targetPos.clone().subtract(this.position).divide(new Victor(20, 20));
					// otherwise, only set x velocity
					else
						this.velocity.x = this.targetPos.clone().subtract(this.position).divide(new Victor(20, 20)).x;
				};
			};
			
			// update onGround variable
			this.onGround = false;
			
			// update if they're on the ground
			// loop through terrain objects
			for (var i = 0; i < terrains.length; ++i) {
				// get currently looped terrain object
				var currentTerrain = terrains[i];
				
				// update onGround variable by comparing pos to each terrain object
				if (this.position.x < currentTerrain.position.x + TERRAIN_WIDTH && this.position.x + this.bounds.x > currentTerrain.position.x) {
					if (this.position.y + this.bounds.y == currentTerrain.position.y && currentTerrain.isSolid() && this.velocity.y >= 0) {
						this.onGround = true;
						break;
					}
				}
			};
			
			// only jump or apply gravity on non-flying enemies
			if (this.enemyType.AI != "flying") {
				// attempt to jump if it falls below the terrain line
				if (this.position.y + this.bounds.y > canvas.height - TERRAIN_HEIGHT)
					this.jump(15, 1);
			
				// update phsyics
				if (!this.onGround)
					this.velocity.y += GRAVITY*dt
			}
			
			// loop through velocity
			for (var i = 0; i < this.velocity.length(); ++i) {	
				// distance we'll move along each axis this loop
				var moveDistX = 0; var moveDistY = 0;
				// move distance is 1, or the decimal remainder of velocity on the last loop
				// only actually update the moveDist if it would be > 0
				if (Math.abs(this.velocity.x) - i > 0)
					moveDistX = (Math.abs(this.velocity.x) - i < 1 ? Math.abs(this.velocity.x) - i : 1) * Math.sign(this.velocity.x);
				// only do vertical target tracking if they're a flying enemy
				if (Math.abs(this.velocity.y) - i > 0)
					moveDistY = (Math.abs(this.velocity.y) - i < 1 ? Math.abs(this.velocity.y) - i : 1) * Math.sign(this.velocity.y);
				
				// variable to store if its safe to move
				var positionSafe = true;
				
				// loop through terrain objects and check if we can move down
				for (var ii = 0; ii < terrains.length; ++ii) {
					// get currently looped terrain object
					var currentTerrain = terrains[ii];
					
					// check is position we'd move to is safe (above terrain)
					// terrain we're checking is below is
					if (this.position.x < currentTerrain.position.x + TERRAIN_WIDTH && this.position.x + this.bounds.x + moveDistX > currentTerrain.position.x) {
						// terrain below us is solid ground and we'd be inside it if we moved down
						if (this.position.y + this.bounds.y + moveDistY > currentTerrain.position.y && currentTerrain.isSolid()) {
							// it's not safe to move
							positionSafe = false;
							break;
						};
					};
				};
				
				// if we're safe to move, shift down
				if (positionSafe || (this.position.y + this.bounds.y > currentTerrain.position.y && this.enemyType.AI != "flying")) {
					this.position.x += moveDistX;
					this.position.y += moveDistY;
					//console.log(this.position + ", " + this.onGround + ", " + this.velocity.toString());
				}
				// otherwise, stick to the terrain
				else {
					this.velocity.y = 0;
					this.position.y = canvas.height - TERRAIN_HEIGHT - this.bounds.y;
					this.numJumps = 0;
					this.onGround = true;
					break;
				};
			}
			
			// if it's on the ground, forcibly ground it
			if (this.onGround) {
				this.velocity.y = 0;
				this.position.y = canvas.height - TERRAIN_HEIGHT - this.bounds.y;
				this.numJumps = 0;
			};
			
			// attempt to shoot a projectile if anyone is alive
			if (rand(0, 15) < 0.1 && players.length > 0) {
				for (var i = 0; i < players.length; ++i)
					if (players[i].order == 0 && players[i].deathTime <= 0) {
						projectiles.push(new Projectile(this.position.x, this.position.y, players[i], PROJECTILE_TYPES.FIREBALL, true));
						break;
					}
			}
				
			// DRAW: draw the enemy
			this.draw();
		};
	
		// FUCNTION: main enemy draw call
		this.draw = function() {
			// increment timing for animation
			if (this.onGround || this.enemyType.AI === "flying")
				this.time = (this.time+0.75) % 28;
			else
				if (this.time != 0 && this.time != 13)
					this.time = Math.round(this.time+1) % 28;
					
			ctx.save();
			// rats have completed art, so draw their sprite from their sheet
			ctx.drawImage(this.enemyType.img, this.frameWidth*Math.floor(this.time), 0, this.frameWidth, this.frameHeight, this.position.x + this.offset.x, this.position.y + this.offset.y, this.frameWidth, this.frameHeight);
			
			// draw health above head
			ctx.fillStyle = "red";
			ctx.fillRect(this.position.x+10, this.position.y - 10, this.bounds.x-20, 5);
			ctx.fillStyle = "green";
			ctx.fillRect(this.position.x+10, this.position.y - 10, (this.bounds.x-20) * (this.health/this.maxHealth), 5);
			ctx.fill();
			ctx.restore();
		};
	};
 
	// CLASS: particle system
	function ParticleSystem(root, particleType, lifetime, particleLifetime, particlesPerFrame) {
		// assign starting variables
		this.root = root;						// the object this is linked to
		this.position = root.position.clone();	// system's position
		this.time = 0;							// system's time lived
		
		// update particle system
		this.update = function() {
			// delete this if its root is gone
			if (this.root == undefined) {
				particleSystems.splice(particleSystems.indexOf(this), 1);
				return;
			}
		
			// stick to the root object
			this.position = root.position.clone().add(root.bounds.clone().divide(Victor(2, 2)));
		
			// attempt to create new particles
			if (particlesPerFrame >= 1) {
				for (var i = 0; i < particlesPerFrame; ++i)
					particles.push(new Particle(this, particleType, particleLifetime));
			}
			// only a chance to create one if <1 per frame
			else if (Math.random() < particlesPerFrame)
				particles.push(new Particle(this, particleType, particleLifetime));
			
			// increment time lived
			++this.time;
			// delete this system if its time lived has surpassed its lifetime
			if (this.time > lifetime && lifetime > 0) {
				particleSystems.splice(particleSystems.indexOf(this), 1);
			}
		}
	}
	
	// CLASS: particle
	function Particle(parent, particleType, lifetime) {
		// inherits from MobileGameObject
		MobileObject.call(this);
	
		// assign starting variables
		this.parent = parent;
		this.particleType = particleType;	// what type of particle this is
		this.deathtime = 0; 				// used to kill particles if they don't die naturally
		this.lifetime = lifetime;
		this.position = new Victor(parent.root.position.x + parent.root.bounds.x/10 + Math.random()*parent.root.bounds.x*0.8, parent.root.position.y + parent.root.bounds.y/10 + Math.random()*parent.root.bounds.y*0.8);
		this.velocity = this.particleType.vel.call(this);
		this.bounds = new Victor(3, 3);
		this.time = 0;
		
		// update particle
		this.update = function() {
			// affected by gravity based on particle type
			if (this.particleType.gravity)
				this.velocity.y += GRAVITY*dt;
		
			// if particle type collides with terrain, do pixel collisions
			if (this.particleType.collidesTerrain) {
				// loop through velocity
				for (var i = 0; i < this.velocity.length(); ++i) {	
				// distance we'll move along each axis this loop
				var moveDistX = 0; var moveDistY = 0;
				// move distance is 1, or the decimal remainder of velocity on the last loop
				// only actually update the moveDist if it would be > 0
				if (Math.abs(this.velocity.x) - i > 0)
					moveDistX = (Math.abs(this.velocity.x) - i < 1 ? Math.abs(this.velocity.x) - i : 1) * Math.sign(this.velocity.x);
				// only do vertical target tracking if they're a flying enemy
				if (Math.abs(this.velocity.y) - i > 0)
					moveDistY = (Math.abs(this.velocity.y) - i < 1 ? Math.abs(this.velocity.y) - i : 1) * Math.sign(this.velocity.y);
				
				// variable to store if its safe to move
				var positionSafe = true;
				
				// loop through terrain objects and check if we can move down
				for (var ii = 0; ii < terrains.length; ++ii) {
					// get currently looped terrain object
					var currentTerrain = terrains[ii];
					
					// check is position we'd move to is safe (above terrain)
					// terrain we're checking is below is
					if (this.position.x < currentTerrain.position.x + TERRAIN_WIDTH && this.position.x + this.bounds.x + moveDistX > currentTerrain.position.x) {
						// terrain below us is solid ground and we'd be inside it if we moved down
						if (this.position.y + this.bounds.y + moveDistY > currentTerrain.position.y && currentTerrain.isSolid()) {
							// it's not safe to move
							positionSafe = false;
							break;
						};
					};
				};
				
				// if we're safe to move, shift down
				if (positionSafe || (this.position.y + this.bounds.y > currentTerrain.position.y)) {
					this.position.x += moveDistX;
					this.position.y += moveDistY;
				}
				// otherwise, bounce
				else {
					this.velocity.y *= -0.85;
					break;
				};
			}
			}
			// otherwise, just move
			else
				this.position.add(this.velocity);
			
			// increment death timer if the particle is barely moving
			if (this.velocity.length() < 0.1)
				++this.deathTime;
			// increment time lived
			++this.time;
			
			// delete this particle if its time lived has surpassed its lifetime, if it has been still for 100 ticks,
			// or if it has moved offscreen
			if ((this.time > this.lifetime && this.lifetime > 0) || this.deathTime > 100 ||
				 this.position.x < 0 || this.position.x > canvas.width || this.position.y < 0 || this.position.y > canvas.height) {
				particles.splice(particles.indexOf(this), 1);
				return;
			}
				
			// draw based on particle type
			ctx.drawImage(this.particleType.img, this.position.x, this.position.y);
		};
	}
 
	// PAUSE FUNCTION: pauses the game
	function pauseGame() {
		// since pause can be called multiple ways
		// prevents multiple redraws of pause screen
		if (!paused) {
			paused = true;
			bgAudio.pause();
			
			// stop the animation loop if the player is alive
			if (currentGameState == GAME_STATE.RUNNING)
				cancelAnimationFrame(animationID);
			
			// draw the pause screen
			ctx.save();
			ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			fillText(ctx, "Paused", canvas.width/2, canvas.height/2, "30pt Calibri", "white");
			fillText(ctx, "Press P to unpause", canvas.width/2, canvas.height/2+40, "24pt Calibri", "white");
			ctx.restore();
		};
	};
	
	// RESUME FUNCTION: resumes the game
	function resumeGame() {
		paused = false;
		bgAudio.play();
		
		// forcibly end animation loop in case it's running
		// only end the loop if the player is alive
		if (currentGameState == GAME_STATE.RUNNING) {
			cancelAnimationFrame(animationID);
			// resume ticking
			update();
		}
	};
	
	// FUNCTION: do things based on key presses
	function keyPress(e) {
		// initialize value at keycode to false on first press
		if (keys[e.keyCode] === undefined)
			keys[e.keyCode] = false;
		
		// spacebar - jump!
		if (e.keyCode === KEY.SPACE) {
			// loop players and jump after a delay based on party order
			for (var i = 0; i < players.length; ++i) {
				// only schedule jumps for living players
				if (players[i].deathTime == 0) {
					setTimeout(players[i].jump, players[i].order*jumpFunction(), 15, 1, false);
					globalLastTerrain = terrains[terrains.length-1];
				}
			};
			
			// prevent spacebar page scrolling
			e.preventDefault();
		};
		
		// q - make first player trigger Q ability
		if (e.keyCode === KEY.Q && keys[e.keyCode] == false) {
			// loop players and only initiate ability on one at order 0
			for (var i = 0; i < players.length; ++i) {
				if (players[i].order == 0  && players[i].deathTime == 0)
					players[i].baseAttack();
			};
		};
		
		// w - make first player trigger W ability
		if (e.keyCode === KEY.W && keys[e.keyCode] == false) {
			// loop players and only initiate ability on one at order 0
			for (var i = 0; i < players.length; ++i) {
				if (players[i].order == 0  && players[i].deathTime == 0)
					players[i].midAttack();
			};
		};
		
		// p - toggle game paused
		if (e.keyCode === KEY.P) {
			// check if paused, and toggle it
			if (paused)
				resumeGame();
			else
				pauseGame();
		};
		
		// h - view high scores if on main or death screen
		if (e.keyCode === KEY.H) {
			// return to home screen after viewing high scores
			if (currentGameState === GAME_STATE.HIGHSCORE) {
				currentGameState = GAME_STATE.START;
			}
			else
			if (currentGameState === GAME_STATE.DEAD || currentGameState === GAME_STATE.START) {
				currentGameState = GAME_STATE.HIGHSCORE;
				
				// load in the scores from local storage
				highScores = [];
				for (var i = 0; i < 10; ++i) {
					if (typeof(window.localStorage) != undefined) {
						highScores[i] = window.localStorage.getItem("score"+i);
					}
				}
			}
		}
		
		// set the keycode to true
		// we do this last so we can check if this is the first tick it's pressed
		keys[e.keyCode] = true;
	};
	
	// FUNCTION: do things based on key releases
	function keyRelease(e) {
		keys[e.keyCode] = false;
		// spacebar - jump!
		if (e.keyCode == KEY.SPACE) {
			// prevent spacebar page scrolling
			e.preventDefault();
			 
			// if the player has died, restart the game
			if (currentGameState === GAME_STATE.DEAD) {
				currentGameState = GAME_STATE.START;
			};
			// if we're in between levels, move on to the next one
			if (currentGameState === GAME_STATE.BETWEEN) {
				// disable upgrade shop UI
				windowManager.toggleUI("shopHUD");
				setupLevel();
			};
		};
	};
	
	// FUNCTION: calculate the delta time, used for animation and physics
	function calculateDeltaTime() {
		var now, fps;
		now = (+new Date); 
		fps = 1000 / (now - lastTime);
		fps = clamp(fps, 12, 60);
		lastTime = now; 
		return 1/fps;
	};
	
	// return public interface for engine module
	return {
		init: init,
		paladin: paladin,
		ranger: ranger,
		magi: magi,
		setupGame: setupGame,
		setupLevel: setupLevel,
		loadAssets: loadAssets,
		playStream: playStream,
		update: update,
		pauseGame: pauseGame,
		resumeGame: resumeGame,
		requestFullscreen: requestFullscreen,
		keyPress: keyPress,
		keyRelease: keyRelease
	};
}());