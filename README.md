# Asterinas Website Project

The Asterinas Website is a static Website
hosted by [Github Pages](https://pages.github.com/)
and powered by [Jekyll](https://jekyllrb.com/).

## Development Guide

### Prerequisites

Before you begin,
you'll need to set up your development environment.
This involves installing two critical pieces of software:

- **Bundler:** Bundler manages Ruby gem dependencies, ensuring that you have all the necessary components for Jekyll. Install it from [bundler.io](https://bundler.io/).
- **Jekyll:** Jekyll is the engine behind your GitHub Pages site. It transforms plain text into static websites and blogs. Get it from [jekyllrb.com](https://jekyllrb.com/).

For detailed installation instructions,
refer to the [GitHub Pages guide](https://docs.github.com/en/pages/setting-up-a-github-pages-site-with-jekyll/creating-a-github-pages-site-with-jekyll#prerequisites).

Install [Bundler](https://bundler.io/)
and [Jekyll](https://jekyllrb.com/)
in your development environment.
See the [installation instructions provided by Github Pages](https://docs.github.com/en/pages/setting-up-a-github-pages-site-with-jekyll/creating-a-github-pages-site-with-jekyll#prerequisites).

### Test the site locally

To see your changes in action before they go live, test the site locally.
Here's how:

Step 1. Download the source code and install all dependencies.

```
git clone https://github.com/asterinas/asterinas.github.io
cd asterinas.github.io
bundle install
```

Step 2. Build the site and start a Web server.

```
bundle exec jekyll serve
```

By default, the server will listent on `http://localhost:4000`.

Step 3. Now open your favorite browser to view the site.

### Deploy the site officially

Make modifications to your local copy of the Git repository
and then push the changes or submit a pull request to
[the main repository](https://github.com/asterinas/asterinas.github.io).
Once the modifications are accepted,
the latest version of the site will be deployed automatically.
You can view the live site at https://asterinas.github.io/.
