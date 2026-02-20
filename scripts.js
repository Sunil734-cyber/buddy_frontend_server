    // Add this at the top of your script (before DOMContentLoaded)
    if (window.innerWidth <= 600) {
      document.body.classList.add('mobile-login-active');
    }

    // Global variables
    let scene, camera, renderer, mixer, clock;
    let avatarModels = {};
    let currentUser = null;
    let selectedUser = null;
    let lastPosition = null;
    let nameLabels = {}; // Store username labels above avatars
    let discoLights = []; // Store disco lights
    let isDiscoMode = false; // Track if disco mode is active
    let aiChatEnabled = false;
    let isAnimationTimerActive = false; // Flag to prevent infinite loops
    let currentMode = 'single'; // 'world' or 'single'
    const animationCommands = {
      'dance': 'C',
      'jump': 'J',
      'lay': 'L',
      'sleep': 'L',
      'laugh': 'S',
      'hello': 'H',
      'greet': 'H',
      'hi': 'H',
      'idle': 'I',
      'stand': 'I'
    };
    const socket = io(window.location.origin, {
      withCredentials: true,
      transports: ['websocket'] // Force WebSocket transport
    });
    
    // Initialize the 3D scene
    function initScene() {
      // Scene setup
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x000000);
      
      // Camera setup - position it to see the line of avatars
      camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.set(0, 2.5, 8);
      camera.lookAt(0, 2, 0);
      
      // Renderer setup
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      document.body.appendChild(renderer.domElement);
      
      // Lighting
      const ambientLight = new THREE.AmbientLight(0x404040);
      scene.add(ambientLight);
      
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
      directionalLight.position.set(1, 1, 1);
      scene.add(directionalLight);
      
      // Grid helper
      scene.add(new THREE.GridHelper(10, 10));
      
      // Clock for animations
      clock = new THREE.Clock();
      
      // Handle window resize
      window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      });
    }
    
    // Function to create disco lights
    function createDiscoLights() {
      const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00];
      
      for (let i = 0; i < colors.length; i++) {
        const light = new THREE.PointLight(colors[i], 1, 10);
        light.position.set(0, 3, Math.cos(i) * 3);
        scene.add(light);
        discoLights.push(light);
      }
    }
    
    // Function to remove disco lights
    function removeDiscoLights() {
      discoLights.forEach(light => {
        scene.remove(light);
      });
      discoLights = [];
    }
    
    // Function to animate disco lights
    function animateDiscoLights() {
      const time = clock.getElapsedTime();
      
      discoLights.forEach((light, index) => {
        light.position.x = Math.sin(time + index) * 5;
        light.position.z = Math.cos(time + index) * 5;
        light.intensity = Math.abs(Math.sin(time * 2 + index)); // Pulsing effect
      });
    }
    
    // Add this function
    function createDanceParticles(intensity) {
      const particleCount = Math.floor(50 * intensity);
      const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00];
      
      for (let i = 0; i < particleCount; i++) {
        const geometry = new THREE.SphereGeometry(0.1, 8, 8);
        const material = new THREE.MeshBasicMaterial({
          color: colors[Math.floor(Math.random() * colors.length)]
        });
        const particle = new THREE.Mesh(geometry, material);
        
        // Random position around the avatar
        particle.position.set(
          (Math.random() - 0.5) * 5,
          Math.random() * 3,
          (Math.random() - 0.5) * 5
        );
        
        scene.add(particle);
        
        // Animate and remove
        setTimeout(() => {
          scene.remove(particle);
        }, 2000);
      }
    }
    
    // Function to create username label
    function createUsernameLabel(username) {
      // Create canvas for text
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = 256;
      canvas.height = 64;
      
      // Set text style
      context.fillStyle = 'white';
      context.font = '24px Arial';
      context.textAlign = 'center';
      context.fillText(username, 128, 32);
      
      // Create texture from canvas
      const texture = new THREE.CanvasTexture(canvas);
      
      // Create sprite material
      const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture,
        transparent: true,
        opacity: 0.8
      });
      
      // Create sprite
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.scale.set(2, 0.5, 1);
      sprite.position.set(0, 2, 0); // Position above avatar
      
      return sprite;
    }
    
    // Function to update username label position
    function updateUsernameLabel(username) {
      if (nameLabels[username] && avatarModels[username]) {
        const avatar = avatarModels[username].model;
        const label = nameLabels[username];
        
        // Position label above avatar
        label.position.set(
          avatar.position.x,
          avatar.position.y + 5,
          avatar.position.z
        );
        
        // Make label always face camera
        label.lookAt(camera.position);
      }
    }
    
    // Function to add username label
    function addUsernameLabel(username) {
      // Only show labels for other users (not current user)
      if (username !== currentUser) {
        const label = createUsernameLabel(username);
        nameLabels[username] = label;
        scene.add(label);
      }
    }
    
    // Function to remove username label
    function removeUsernameLabel(username) {
      if (nameLabels[username]) {
        scene.remove(nameLabels[username]);
        delete nameLabels[username];
      }
    }
    
    // Modify the loadAvatarModel function to accept position
    function loadAvatarModel(username, animationFile, position = null) {
      const loader = new FBXLoader();
      
      loader.load(
        animationFile,
        (object) => {
          try {
            object.scale.set(1, 1, 1);
            
            // Material setup
            object.traverse((child) => {
              if (child.isMesh) {
                child.material = new THREE.MeshStandardMaterial({
                  color: username === currentUser ? 0xFFFF00 : 0x00FF00,
                  roughness: 0.8
                });
              }
            });

            // Set position if provided
            if (position) {
              object.position.set(position.x, position.y, position.z);
            }

            // Create or update model
            if (!avatarModels[username]) {
              avatarModels[username] = { model: object, mixer: null, currentAnimation: animationFile };
            } else {
              scene.remove(avatarModels[username].model);
              avatarModels[username].model = object;
              avatarModels[username].currentAnimation = animationFile;
            }
            
            scene.add(object);
            addUsernameLabel(username);
            
            // Compute bounding box and width for dynamic spacing
            const bbox = new THREE.Box3().setFromObject(object);
            const size = new THREE.Vector3();
            bbox.getSize(size);
            const avatarWidth = size.x;
            
            // Send the measured width to server
            socket.emit('avatar_width', { username: username, width: avatarWidth });
            
            // Animation setup
            if (object.animations?.length > 0) {
              avatarModels[username].mixer = new THREE.AnimationMixer(object);
              const action = avatarModels[username].mixer.clipAction(object.animations[0]);
              action.play();
            }
          } catch (error) {
            console.error('Model processing error:', error);
          }
        },
        (xhr) => {
          const percent = (xhr.loaded / xhr.total) * 100;
          updateStatus(`Loading ${username}: ${Math.round(percent)}%`, percent);
        },
        (error) => {
          console.error(`Model load error for ${username}:`, error);
        }
      );
    }
    
    // Update status display
    function updateStatus(msg, progress = null) {
      const statusEl = document.getElementById('status');
      const progressEl = document.getElementById('progress');
      
      if (statusEl) statusEl.textContent = msg;
      if (progressEl && progress !== null) progressEl.value = progress;
    }
    
    // Add to animation loop
    function animate() {
      requestAnimationFrame(animate);
      
      const delta = clock.getDelta();
      
      // Update all mixers
      Object.values(avatarModels).forEach(avatar => {
        if (avatar.mixer) {
          avatar.mixer.update(delta);
        }
      });
      
      // Update username label positions
      Object.keys(nameLabels).forEach(username => {
        updateUsernameLabel(username);
      });
      
      // Animate disco lights if active
      if (isDiscoMode) {
        animateDiscoLights();
      }
      
      // Send position updates (local user only)
      if (currentUser && avatarModels[currentUser]) {
        const model = avatarModels[currentUser].model;
        const newPosition = model.position.clone();
        
        if (!lastPosition || lastPosition.distanceTo(newPosition) > 0.01) {
          socket.emit('avatar_position', {
            x: newPosition.x,
            y: newPosition.y,
            z: newPosition.z
          });
          lastPosition = newPosition;
        }
      }
      
      renderer.render(scene, camera);
    }
    
    // Function to switch modes
    function setMode(newMode) {
      if (currentMode === newMode) return;
      
      currentMode = newMode;
      
      // Update UI elements
      document.getElementById('world-mode-btn').classList.toggle('active', newMode === 'world');
      document.getElementById('single-mode-btn').classList.toggle('active', newMode === 'single');
      document.getElementById('mode-indicator').className = `mode-indicator ${newMode}`;
      
      // Notify server
      socket.emit('set_mode', newMode);
      
      // Handle client-side changes
      if (newMode === 'world') {
        // Request fresh world state
        socket.emit('request_world_state');
        
        // Reapply world mode positioning
        Object.keys(avatarModels).forEach(username => {
          if (username !== currentUser) {
            socket.emit('request_user_position', username);
          }
        });
      } else {
        // Single mode - remove other avatars and reset current user position
        Object.keys(avatarModels).forEach(username => {
          if (username !== currentUser) {
            scene.remove(avatarModels[username].model);
            removeUsernameLabel(username);
          }
        });
        
        // Reset current user's avatar position to (0,0,0) in single mode
        if (avatarModels[currentUser]) {
          avatarModels[currentUser].model.position.set(0, 0, 0);
        }
      }
    }
    
    // Function to show mode change notification
    function showModeNotification(title, message) {
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 60px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(30, 30, 40, 0.9);
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        border-left: 5px solid ${currentMode === 'world' ? '#4CAF50' : '#FF9800'};
        font-family: Arial, sans-serif;
        z-index: 1000;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        text-align: center;
        max-width: 300px;
        animation: fadeInOut 5s forwards;
      `;
      
      notification.innerHTML = `
        <div style="font-weight: bold; font-size: 18px; margin-bottom: 5px;">${title}</div>
        <div>${message}</div>
      `;
      
      document.body.appendChild(notification);
      
      // Add CSS for animation
      const style = document.createElement('style');
      style.innerHTML = `
        @keyframes fadeInOut {
          0% { opacity: 0; top: 40px; }
          10% { opacity: 1; top: 60px; }
          90% { opacity: 1; top: 60px; }
          100% { opacity: 0; top: 40px; }
        }
      `;
      document.head.appendChild(style);
      
      // Remove after animation completes
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 5000);
    }
    
    // Initialize the application
    function init() {
      initScene();
      animate();
      setupEventListeners();
      
      // Hide loading screen when ready
      setTimeout(() => {
        document.getElementById('loading').style.display = 'none';
      }, 500);
    }
    
    // Set up event listeners
    function setupEventListeners() {
      // Mode toggle buttons
      document.getElementById('world-mode-btn').addEventListener('click', () => setMode('world'));
      document.getElementById('single-mode-btn').addEventListener('click', () => setMode('single'));
      
      // Login button
      document.getElementById('login-button').addEventListener('click', () => {
        const username = document.getElementById('username-input').value.trim();
        if (username) {
          socket.emit('register', username);
        }else {
      // Show warning when no username is entered
      const warningDiv = document.createElement('div');
      warningDiv.style.cssText = `
        position: fixed;
        top: 30%;
        left: 47.9%;
        transform: translate(-50%, -50%);
        background: rgba(128, 128, 128, 0.95); 
        color: black;
        padding: 5px 10px;
        border-radius: 8px;
        font-weight: bold;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      `;
      const warningImage = document.createElement('img');
      const spanText = document.createElement('span');
      
      warningImage.src = 'image.png'; // Fixed path - relative to HTML file
      warningImage.style.width = '20px';
      warningImage.style.height = '20px';
      warningImage.style.marginRight = '8px';
      warningImage.style.verticalAlign = 'middle';
      
      spanText.textContent = 'Please enter your Buddy Name';

      warningDiv.appendChild(warningImage);
      warningDiv.appendChild(spanText);

      document.body.appendChild(warningDiv);

// Remove warning after 3 seconds
      setTimeout(() => {
      if (warningDiv.parentNode) {
          warningDiv.parentNode.removeChild(warningDiv);
        }
        }, 3000);

          }
        });
      
      // Dance move buttons
      document.querySelectorAll('#controls button[data-animation]').forEach(btn => {
        btn.addEventListener('click', () => {
          const animationFile = btn.getAttribute('data-animation');
          socket.emit('change_animation', animationFile);
        });
      });
      
      // Chat send button
      document.getElementById('send-button').addEventListener('click', sendChatMessage);
      document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
      });
      
      // AI Chat send button
      document.getElementById('ai-send-button').addEventListener('click', sendAIChatMessage);
      document.getElementById('ai-chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendAIChatMessage();
      });
     

document.getElementById('info-panel').addEventListener('click', () => {
  document.getElementById('info-content').style.display = 'block';
});

document.getElementById('close-info').addEventListener('click', () => {
  document.getElementById('info-content').style.display = 'none';
});

// Close info panel when clicking outside
document.addEventListener('click', (e) => {
  const infoContent = document.getElementById('info-content');
  if (infoContent.style.display === 'block' && 
      !e.target.closest('#info-content') && 
      e.target.id !== 'info-panel') {
    infoContent.style.display = 'none';
  }
});
      
      // Socket.io events
      socket.on('registration_success', () => {
        currentUser = document.getElementById('username-input').value.trim();
        document.getElementById('login-panel').style.display = 'none';
        document.getElementById('social-panel').style.display = 'block';
        document.getElementById('chat-panel').style.display = 'block';
        document.getElementById('ai-chat-panel').style.display = 'block';
        document.getElementById('mode-toggle-container').style.display = 'flex';
        // Info panel functionality

        
        // Load default avatar
        loadAvatarModel(currentUser, 'Standing Idle.fbx');

        // Remove the mobile-login-active class so UI panels show up
        document.body.classList.remove('mobile-login-active');

        // After showing the AI chat panel, add this line:
        document.getElementById('ai-chat-messages').innerHTML = '<div class="message ai-message"><strong>Buddy:</strong> Welcome to Buddyyy</div>';
      });
      
      socket.on('registration_failed', (msg) => {
        alert(`Registration failed: ${msg}`);
      });
      
      socket.on('user_list', (users) => {
        const userListEl = document.getElementById('user-list');
        userListEl.innerHTML = '';
        
        users.forEach(user => {
          if (user !== currentUser) {
            const userItem = document.createElement('div');
            userItem.className = 'user-item';
            userItem.textContent = user;
            userItem.addEventListener('click', () => {
              document.querySelectorAll('.user-item').forEach(item => {
                item.classList.remove('selected');
              });
              userItem.classList.add('selected');
              selectedUser = user;
            });
            userListEl.appendChild(userItem);
          }
        });
      });
      
      // Add to socket event listeners
      socket.on('world_state', async (worldState) => {
        if (currentMode !== 'world') return;
        
        const loadPromises = Object.entries(worldState)
          .filter(([username]) => username !== currentUser)
          .map(([username, userData]) => 
            loadAvatarModel(username, userData.animation, userData.position)
          );
        
        await Promise.all(loadPromises);
        updateDebugLabels();
      });

      // Update avatar_updated handler
      socket.on('avatar_updated', (data) => {
        // Process updates for our own avatar in any mode
        // Process updates for others only in world mode
        if (data.username !== currentUser && currentMode !== 'world') return;
        
        console.log(`Avatar updated for ${data.username} to ${data.animation}`);
        
        // Don't activate disco mode if this is triggered by the timer
        if (isAnimationTimerActive && data.animation === 'Chicken Dance.fbx') {
          console.log('Skipping disco mode activation (timer reset)');
        } else {
          // Check if anyone is doing chicken dance to activate disco mode
          let hasChickenDance = false;
          Object.values(avatarModels).forEach(avatar => {
            if (avatar.currentAnimation === 'Chicken Dance.fbx') {
              hasChickenDance = true;
            }
          });
          
          // Check if the new animation is chicken dance
          if (data.animation === 'Chicken Dance.fbx') {
            hasChickenDance = true;
          }
          
          // Toggle disco mode based on chicken dance presence
          if (hasChickenDance && !isDiscoMode) {
            isDiscoMode = true;
            createDiscoLights();
            console.log('Disco mode activated! 🕺');
          } else if (!hasChickenDance && isDiscoMode) {
            isDiscoMode = false;
            removeDiscoLights();
            console.log('Disco mode deactivated! 😴');
          }
        }
        
        if (avatarModels[data.username]) {
          const avatar = avatarModels[data.username];
          
          // Store current animation
          avatar.currentAnimation = data.animation;
          
          // 1. Stop current animation
          if (avatar.mixer) {
            avatar.mixer.stopAllAction();
          }
          
          // 2. Load new animation without replacing the entire model
          const loader = new FBXLoader();
          loader.load(
            data.animation,
            (animObject) => {
              // 3. Transfer animations to existing model
              avatar.model.animations = animObject.animations;
              
              // 4. Recreate mixer with new animations
              avatar.mixer = new THREE.AnimationMixer(avatar.model);
              
              // 5. Play animation if available
              if (animObject.animations && animObject.animations.length > 0) {
                const action = avatar.mixer.clipAction(animObject.animations[0]);
                action.play();
                console.log(`Playing ${data.animation} for ${data.username}`);
              }
              
              // 6. Clean up temp object
              animObject = null;
            },
            undefined,
            (error) => console.error('Animation load error:', error)
          );
        } else {
          // Load new avatar if it doesn't exist
          loadAvatarModel(data.username, data.animation);
        }
      });
      
      socket.on('chat_message', (data) => {
        const chatMessages = document.getElementById('chat-messages');
        const messageEl = document.createElement('div');
        messageEl.className = 'message';
        messageEl.innerHTML = `<strong>${data.username}:</strong> ${data.message}`;
        chatMessages.appendChild(messageEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;
      });
      
      // Handle user disconnections
      socket.on('user_disconnected', (username) => {
        // Only process if in world mode
        if (currentMode !== 'world') return;
        
        if (avatarModels[username]) {
          scene.remove(avatarModels[username].model);
          delete avatarModels[username];
        }
        
        // Remove username label
        removeUsernameLabel(username);
        
        // Update UI
        const userItems = document.querySelectorAll('.user-item');
        userItems.forEach(item => {
          if (item.textContent === username) {
            item.remove();
          }
        });
      });

      // Handle position updates from server
      socket.on('avatar_position_update', async (data) => {
        // Only process if in world mode
        if (currentMode !== 'world') return;
        
        if (avatarModels[data.username]) {
          avatarModels[data.username].model.position.set(
            data.position.x,
            data.position.y,
            data.position.z
          );
        } else {
          await loadAvatarModel(data.username, 'Standing Idle.fbx', data.position);
        }
        updateDebugLabels();
      });
      
      // Add this to socket.io events
      socket.on('special_effect', (data) => {
        if (data.type === 'disco') {
          if (!isDiscoMode) {
            isDiscoMode = true;
            createDiscoLights();
            console.log('Disco mode activated!');
          }
          
          // Add some particles for fun
          createDanceParticles(data.intensity);
        }
      });
      
      // Add new event to handle mode changes from server
      socket.on('user_mode_changed', (data) => {
        // If someone else switched to single mode, remove their avatar
        if (data.mode === 'single' && data.username !== currentUser) {
          if (avatarModels[data.username]) {
            scene.remove(avatarModels[data.username].model);
            delete avatarModels[data.username];
          }
          removeUsernameLabel(data.username);
        }
      });
      
      // Add new socket listener for position requests
      socket.on('user_position_response', (data) => {
        if (currentMode !== 'world') return;
        
        if (avatarModels[data.username]) {
          avatarModels[data.username].model.position.set(
            data.position.x,
            data.position.y,
            data.position.z
          );
        }
      });

      // Panel toggle functionality
      document.getElementById('social-panel').addEventListener('click', toggleSocialPanel);
      document.getElementById('chat-panel').addEventListener('click', toggleChatPanel);
      
      // Prevent chat input and send button from toggling the panel
      document.getElementById('chat-input').addEventListener('click', (e) => {
        e.stopPropagation();
      });
      
      document.getElementById('send-button').addEventListener('click', (e) => {
        e.stopPropagation();
      });
      
      // Prevent user list clicks from toggling the social panel
      document.getElementById('user-list').addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }
    
    // Send chat message
    function sendChatMessage() {
      const input = document.getElementById('chat-input');
      const message = input.value.trim();
      
      if (message && currentUser) {
        socket.emit('chat_message', {
          username: currentUser,
          message: message
        });
        input.value = '';
      }
    }
    
    // Add this new function
    function sendAIChatMessage() {
      const input = document.getElementById('ai-chat-input');
      const message = input.value.trim();
      
      if (!message) return;
      
      // Create user message in AI chat
      addAIChatMessage(message, true);
      input.value = '';
      
      // Check for animation commands
      const lowerMsg = message.toLowerCase();
      let commandFound = false;
      
      for (const [keyword, cmd] of Object.entries(animationCommands)) {
        if (lowerMsg.includes(keyword)) {
          commandFound = true;
          console.log(`Dance command: ${cmd}`);
          triggerAnimation(cmd);
          
          // Add auto-response based on command
          const responses = {
            'C': "*starts dancing* Let's groove! 💃",
            'J': "*jumps excitedly* Wheee! 🤸",
            'L': "*lays down* Ahh, this is relaxing... 😌",
            'S': "*laughs heartily* That was funny! 🤣",
            'H': "*waves happily* Hello there! 👋"
          };
          
          setTimeout(() => {
            addAIChatMessage(responses[cmd], false);
          }, 1000);
          break;
        }
      }
      
      // If no command found, send to AI
      if (!commandFound) {
        fetchAIResponse(message);
      }
    }
    
    // Add this function
    function addAIChatMessage(text, isUser) {
      const chatMessages = document.getElementById('ai-chat-messages');
      const messageEl = document.createElement('div');
      messageEl.className = isUser ? 'message' : 'message ai-message';
      messageEl.innerHTML = isUser 
        ? `<strong>You:</strong> ${text}`
        : `<strong>Buddy:</strong> ${text}`;
      chatMessages.appendChild(messageEl);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Add this function
    function fetchAIResponse(message) {
  const chatbotUrl = window.AI_CHATBOT_URL || "https://newone-yzub.onrender.com/chatbot/";
  console.log("Sending AI request to:", chatbotUrl);
  console.log("Message:", message);
  
  fetch(chatbotUrl, {
    method: "POST",
    mode: "cors",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message })
  })
      .then(response => {
        console.log("Response status:", response.status);
        console.log("Response headers:", response.headers);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log("AI Response data:", data);
        // Add text response to chat
        addAIChatMessage(data.reply, false);
        
        // Check for bracketed animation commands in the response
        const responseText = data.reply;
        if (responseText.includes('[L]')) {
          triggerAnimation('L');
        } else if (responseText.includes('[C]')) {
          triggerAnimation('C');
        } else if (responseText.includes('[J]')) {
          triggerAnimation('J');
        } else if (responseText.includes('[S]')) {
          triggerAnimation('S');
        } else if (responseText.includes('[H]')) {
          triggerAnimation('H');
        }
        
        // Trigger animation if provided
        if (data.animation) {
          triggerAnimation(data.animation);
        }
      })
      .catch(error => {
        console.error("AI Error:", error);
        addAIChatMessage("Buddy is resting right now... Error: " + error.message, false);
      });
    }
    
    // Add this function
    function triggerAnimation(cmd) {
  const animationMap = {
    'C': 'Chicken Dance.fbx',
    'J': 'Jumping Down.fbx',
    'L': 'Laying.fbx',
    'S': 'Sitting Laughing.fbx',
    'H': 'Standing Greeting.fbx',
    'I': 'Standing Idle.fbx'
  };
  
  const animFile = animationMap[cmd];
  if (animFile) {
    // Clear any existing timers
    if (window.animationResetTimer) {
      clearTimeout(window.animationResetTimer);
    }
    
    // Play animation immediately (local fallback)
    playLocalAnimation(currentUser, animFile);
    
    // Also send to server (for world mode)
    socket.emit('change_animation', animFile);
    
    // Set timer to return to idle
    const animationDurations = {
      'H': 5000, 'C': 8000, 'J': 3000, 
      'L': 10000, 'S': 8000
    };
    
    const duration = animationDurations[cmd];
    if (duration) {
      window.animationResetTimer = setTimeout(() => {
        playLocalAnimation(currentUser, 'Standing Idle.fbx');
        socket.emit('change_animation', 'Standing Idle.fbx');
      }, duration);
    }
  }
}

// Add this new function for local animation handling
function playLocalAnimation(username, animationFile) {
  const avatar = avatarModels[username];
  if (!avatar) return;

  // Stop current animation
  if (avatar.mixer) {
    avatar.mixer.stopAllAction();
  }

  // Load new animation
  const loader = new FBXLoader();
  loader.load(
    animationFile,
    (animObject) => {
      avatar.model.animations = animObject.animations;
      avatar.mixer = new THREE.AnimationMixer(avatar.model);
      if (animObject.animations?.length > 0) {
        const action = avatar.mixer.clipAction(animObject.animations[0]);
        action.play();
      }
    },
    undefined,
    (error) => console.error('Animation load error:', error)
  );
}
    
    // Add this utility function
    function getCSRFToken() {
      const name = "csrftoken";
      const cookies = document.cookie.split(";");
      for (let c of cookies) {
        const trimmed = c.trim();
        if (trimmed.startsWith(name + "=")) {
          return decodeURIComponent(trimmed.split("=")[1]);
        }
      }
      return "";
    }
    
    // Panel toggle functions
    function toggleSocialPanel() {
      const panel = document.getElementById('social-panel');
      const content = document.getElementById('social-content');
      const chatPanel = document.getElementById('chat-panel');
      const chatContent = document.getElementById('chat-content');
      
      // Toggle social panel
      if (content.classList.contains('show')) {
        content.classList.remove('show');
        panel.classList.remove('expanded');
      } else {
        content.classList.add('show');
        panel.classList.add('expanded');
        // Close chat panel if open
        chatContent.classList.remove('show');
        chatPanel.classList.remove('expanded');
      }
    }
    
    function toggleChatPanel() {
      const panel = document.getElementById('chat-panel');
      const content = document.getElementById('chat-content');
      const socialPanel = document.getElementById('social-panel');
      const socialContent = document.getElementById('social-content');
      
      // Toggle chat panel
      if (content.classList.contains('show')) {
        content.classList.remove('show');
        panel.classList.remove('expanded');
      } else {
        content.classList.add('show');
        panel.classList.add('expanded');
        // Close social panel if open
        socialContent.classList.remove('show');
        socialPanel.classList.remove('expanded');
      }
    }
    
    // Start the application when DOM is loaded
    document.addEventListener('DOMContentLoaded', () => {
      // Wait for modules to load before initializing
      function startApp() {
        document.getElementById('world-mode-btn').classList.remove('active');
        document.getElementById('single-mode-btn').classList.add('active');
        document.getElementById('mode-indicator').className = 'mode-indicator single';
        init();
      }
      
      // Check if modules are already loaded, otherwise wait
      if (window.modulesLoaded) {
        startApp();
      } else {
        window.addEventListener('modulesloaded', startApp);
      }
    });