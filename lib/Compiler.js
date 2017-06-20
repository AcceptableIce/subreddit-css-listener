const Git = require("nodegit");
const path = require("path");
const fs = require("fs");
const remove = require("remove");
const sass = require("node-sass");
const secrets = require("../secrets.json");
const snoowrap = require("snoowrap");

module.exports = class Compiler {
	static recompile(ssh_url) {
		const repoDir = path.join(__dirname, "..", "repo");
				
		if(fs.existsSync(repoDir)) {
			remove.removeSync(repoDir);
		}

		const gitOptions = {
			fetchOpts: {
				callbacks: {
					certificateCheck: () => 1,
					credentials: function() {
						return Git.Cred.userpassPlaintextNew(secrets.githubToken, "x-oauth-basic");
					}
				}
			}
		};

		Git.Clone(ssh_url, repoDir, gitOptions).then(repo => {
			repo.getHeadCommit().then(commit => {
				const commitHash = commit.sha();

				sass.render({
					file: path.join(repoDir, secrets.sassFile)
				}, (err, result) => {
					if(err) {
						console.error("[subreddit-css-listener] Invalid SASS file(s)!", err);
					} else {
						const cssBody = "/**\n" +
						`* Stylesheet for r/${secrets.subredditName} generated at ${new Date().toLocaleString()}.\n` +
						"* DO NOT MAKE CHANGES TO THIS STYLESHEET; THEY WILL BE OVERRIDDEN.\n" +
						"* Make your changes in the repository:\n" +
						`* ${secrets.repository}\n` +
						`*/\n${result.css.toString()}`;

						fs.writeFileSync(path.join(repoDir, "subreddit.css"), cssBody);

						// Update reddit
						const reddit = new snoowrap({
							userAgent: "subreddit-css-listener",
							clientId: secrets.reddit.clientId,
							clientSecret: secrets.reddit.accessToken,
							refreshToken: secrets.reddit.refreshToken
						});


						const subreddit = reddit.getSubreddit(secrets.subredditName);
						
						console.log(`Updating r/${subreddit.display_name}...`);
						
						subreddit.submitSelfpost({ title: "Auth Test", text: "Hello!" });
						/*reddit.getSubreddit(secrets.subredditName)._post({
							uri: "/api/subreddit_stylesheet",
							form: {
								api_type: "json",
								op: "save",
								reason: `Repository commit ${commitHash}`,
								stylesheet_contents: cssBody
							}
						});*/
					}
				});
			});
		}).catch(console.error);
	}
};