const { getAdmin } = require('./clients');

function notificationRepo(db = getAdmin()) {
  const check = (error) => { if (error) throw new Error('Notification database request failed.'); };
  return {
    async claim() {
      const { data, error } = await db.rpc('claim_admin_email_notification');
      check(error);
      return data;
    },
    async update(job, patch) {
      const { data, error } = await db.from('admin_email_notifications').update(patch)
        .eq('id', job.id).eq('status', 'processing').eq('lease_token', job.lease_token)
        .select('id').maybeSingle();
      check(error);
      if (!data) throw new Error('Notification lease was lost.');
    },
  };
}

module.exports = { notificationRepo };
