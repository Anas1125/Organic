// Use the logo and name from the last visit straight away (no flash of the default leaf).
// First visit: a blank icon until the site settings load.
(function () {
  var href = 'data:,'
  try {
    var c = JSON.parse(localStorage.getItem('terralens_site') || 'null')
    if (c) {
      href = c.logo_url || '/leaf.svg'
      if (c.site_name) document.title = c.site_name + ' — GI-Tagged Products, Wholesale'
    }
  } catch (e) {}
  var l = document.createElement('link')
  l.rel = 'icon'
  l.href = href
  document.head.appendChild(l)
})()
