const url=process.env.APP_URL,secret=process.env.CRON_SECRET;
if(!url||!secret)throw new Error('Set APP_URL and CRON_SECRET on the cron service');
const result=await fetch(new URL('/api/jobs/reminders',url),{method:'POST',headers:{Authorization:'Bearer '+secret},signal:AbortSignal.timeout(240000)});
if(!result.ok)throw new Error('Reminder job returned '+result.status);console.log(await result.text());
