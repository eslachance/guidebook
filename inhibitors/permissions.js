exports.conf = {
  enabled: true,
  spamProtection: false,
};

exports.run = (client, msg, cmd) => new Promise(async (resolve, reject) => {
  const permlvl = await client.funcs.permissionLevel(client, msg.author, msg.guild).catch(err => client.funcs.log(err, "error"));
  if (msg.guild) {
    msg.member.permLevel = permlvl;
  }
  if (permlvl >= cmd.conf.permLevel) {
    resolve();
  } else {
    reject("You do not have permission to use this command.");
  }
});
