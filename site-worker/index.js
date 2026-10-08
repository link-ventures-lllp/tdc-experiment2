// The tdcreboot site Worker. Everything is static assets except /r/*, the unlisted
// renderings gallery, which the tdc-trivia Worker serves from its Box copy. Handing
// /r/* over here makes the gallery work on hosts a route can't reach (the
// *.workers.dev preview). On tdcreboot.com the zone route sends /r/* to tdc-trivia
// before this Worker runs, so both hosts show the same gallery.
export default {
  async fetch(req, env){
    const url = new URL(req.url);
    if (url.pathname.startsWith('/r/') && env.TRIVIA) return env.TRIVIA.fetch(req);
    return env.ASSETS.fetch(req);
  }
};
