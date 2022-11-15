const cp = require('child_process')

// cp.exec('ls -al',  (err, stdout, stderr) => {
//   console.log(err)
//   console.log(stdout)
//   console.log(stderr)
// })

cp.execFile('ls', ['-al'], (err, stdout, stderr) => {
  console.log(err)
  console.log(stdout)
  console.log(stderr)
})