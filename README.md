# node-monitoring
Simple NodeJS based Linux machines monitoring tool.

![Node Monitoring example](example.png?raw=true "Node Monitoring example")

#### French

Sorry it's in french for now, will maybe do English version.
Feel free to translate in your language.

# Why
I needed to know when something got wrong in my VMs setup or on a production machine.
Consider this script as a beta, and tweak it to your needs.
Pull-Request are really appreceatied if you have any good idea to add to this little tool.

# What

- Monitor SSH machines and get CPU / RAM & SWAP / Disk usage
- Monitor HTTP endpoints
- Monitor local and production machines
- Send a Slack message when any machine is down or behave not correctly
- Setup thresholds for messages

Having slack notifications means notifications on your smartphone, anywhere, anytime :)

# Installation

- Install : `npm i`
- Configure : Copy `config-example.js` to `config.js` and tweak it.
- Launch : `node index`

# Update

- `git pull`