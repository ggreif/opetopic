<script lang="ts">
  const videos = [
    {
      id: "RFm1nz6YV_U",
      title: "\"The (∞,1)-category of Types\", talk by Eric Finster at CQTS @ NYU Abu Dhabi",
      date: "2023-02-18",
      label: "Feb 18, 2023",
      blurb: "Eric Finster presents his work on constructing the (∞,1)-category of types within homotopy type theory, delivered at the Centre for Quantum and Topological Systems at NYU Abu Dhabi.",
    },
    {
      id: "wz3h59rnhOU",
      title: "Eric Finster, Weak structures from strict ones",
      date: "2020-06-19",
      label: "Jun 19, 2020",
      blurb: "A technically dense talk on deriving weak higher categorical structures from strict ones using opetopic methods — aimed at researchers already familiar with the foundations.",
    },
    {
      id: "AnjK4hKp6v4",
      title: "Higher Dimensional Syntax - Eric Finster",
      date: "2016-08-18",
      label: "Aug 18, 2016",
      blurb: "Eric Finster introduces a syntactic framework for reasoning about higher-dimensional categorical structures, laying conceptual groundwork for opetopic type theory.",
    },
    {
      id: "aPBqf72X-I8",
      title: "The Calculus of Opetopes - Eric Finster",
      date: "2016-08-16",
      label: "Aug 16, 2016",
      blurb: "A lecture from the IAS Univalent Foundations program presenting the combinatorial calculus behind opetopes and how it supports a coherent notion of composition in higher categories.",
    },
    {
      id: "hlCVHVtAlqQ",
      title: "Eric Finster, Towards higher universal algebra in type theory",
      date: "2018-12-06",
      label: "Dec 6, 2018",
      blurb: "A talk exploring how opetopic techniques can provide a foundation for universal algebra in homotopy type theory, connecting higher categorical structure to type-theoretic constructions.",
    },
    {
      id: "sEVJJCwohW0",
      title: "Orchard 1 - Introduction",
      date: "2014-01-21",
      label: "Jan 21, 2014",
      blurb: "The first episode of a hands-on walkthrough of Orchard, the original graphical proof assistant for opetopic sets, demonstrating interactive cell construction.",
    },
    {
      id: "3z_k4ML9GWI",
      title: "Orchard 2 - Modifying the Shape",
      date: "2014-01-21",
      label: "Jan 21, 2014",
      blurb: "Continues the Orchard tutorial by showing how to reshape opetopic cells interactively, covering extrusion and other structural editing operations.",
    },
    {
      id: "Vxnf_3Bxj2o",
      title: "Orchard 3 - Composition and Associativity",
      date: "2014-01-21",
      label: "Jan 21, 2014",
      blurb: "Demonstrates how composition of opetopic cells is performed in Orchard and unpacks the associativity structure that emerges from the opetopic pasting diagrams.",
    },
    {
      id: "DRFjUSaNexQ",
      title: "Orchard 4 - Identities and Invertibility",
      date: "2014-01-21",
      label: "Jan 21, 2014",
      blurb: "Explores how identity cells and invertible morphisms are represented and manipulated within the Orchard proof assistant.",
    },
    {
      id: "OANwLohwJqk",
      title: "Opetopic Diagrams 1 - Basics",
      date: "2014-01-20",
      label: "Jan 20, 2014",
      blurb: "An introduction to the visual language of opetopic diagrams: how cells, sources, and targets are depicted and how the pasting shapes arise.",
    },
    {
      id: "E7OvuA1jRKM",
      title: "Opetopic Diagrams 2 - Geometry",
      date: "2014-01-20",
      label: "Jan 20, 2014",
      blurb: "Digs into the geometric intuition behind opetopic diagrams, connecting the planar pictures to the underlying combinatorial data.",
    },
  ]
</script>

<div class="ui raised segment">
  <h2 class="ui dividing header">Videos</h2>

  <p>
    A curated selection of video lectures by Eric Finster on opetopic higher
    category theory — from early proof-assistant demos to foundational talks at
    the Institute for Advanced Study.
  </p>

  <div class="video-list">
    {#each videos as v}
      <div class="video-entry">
        <div class="video-embed">
          <iframe
            src="https://www.youtube.com/embed/{v.id}"
            title={v.title}
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          ></iframe>
        </div>
        <div class="video-meta">
          <h3>{v.title}</h3>
          <span class="video-date">{v.label}</span>
          <p>{v.blurb}</p>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .video-list {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .video-entry {
    display: flex;
    gap: 1.5rem;
    align-items: flex-start;
  }

  .video-embed {
    flex-shrink: 0;
    width: 320px;
  }

  .video-embed iframe {
    width: 320px;
    height: 180px;
    border-radius: 4px;
  }

  .video-meta h3 {
    margin: 0 0 0.25rem;
    font-size: 1.1em;
  }

  .video-date {
    font-size: 0.85em;
    color: #888;
  }

  .video-meta p {
    margin-top: 0.5rem;
  }

  @media (max-width: 600px) {
    .video-entry {
      flex-direction: column;
    }
    .video-embed,
    .video-embed iframe {
      width: 100%;
    }
    .video-embed iframe {
      height: 56vw;
    }
  }
</style>
