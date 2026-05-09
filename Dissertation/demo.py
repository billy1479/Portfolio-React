import streamlit as st
import streamlit.components.v1 as components
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import numpy as np
import hashlib
from pathlib import Path
from streamlit_plotly_events import plotly_events
import math

st.set_page_config(
    page_title="Black Hole Subsystem Classifier Demonstration",
    page_icon="🕳️",
    layout="wide",
)

APP_DIR = Path(__file__).resolve().parent
DATA_PATH = APP_DIR / "demo_exports" / "demo_predictions.csv"

@st.cache_data
def load_data():
    return pd.read_csv(DATA_PATH)

df = load_data()

st.title("Black Hole Subsystem Classifier Demonstration")

st.markdown(
    """
    <style>
    /* Hide Streamlit top-right controls (Deploy + overflow menu). */
    .stDeployButton {
        display: none;
    }
    #MainMenu {
        visibility: hidden;
    }
    [data-testid="stToolbar"] {
        display: none;
    }

    [data-testid="stAppViewContainer"] .main .block-container {
        max-width: none;
        width: 100%;
        padding-top: 2.4rem;
        padding-right: 1.35rem;
        padding-left: 1.35rem;
        padding-bottom: 0;
    }
    h1 {
        margin-bottom: 0;
    }
    @media (max-width: 1280px) {
        [data-testid="stAppViewContainer"] .main .block-container {
            padding-top: 1.8rem;
            padding-right: 0.9rem;
            padding-left: 0.9rem;
            padding-bottom: 0;
        }
    }
    </style>
    """,
    unsafe_allow_html=True,
)

# Trigger plotly resize when sidebar expands/collapses.
components.html(
    """
    <script>
    (() => {
      const parentWindow = window.parent;
      if (!parentWindow || parentWindow.__stSidebarResizeHookInstalled) return;

      const doc = parentWindow.document;
      const sidebar = doc.querySelector('[data-testid="stSidebar"]');
      if (!sidebar) return;

      parentWindow.__stSidebarResizeHookInstalled = true;

      let timeoutId = null;
      const triggerResize = () => parentWindow.dispatchEvent(new Event("resize"));
      const delayedResize = () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(triggerResize, 120);
        setTimeout(triggerResize, 320);
      };

      new MutationObserver(delayedResize).observe(sidebar, {
        attributes: true,
        attributeFilter: ["aria-expanded", "class", "style"],
      });

      sidebar.addEventListener("transitionend", triggerResize);
      triggerResize();
    })();
    </script>
    """,
    height=0,
)

# --------------------------------------------------
# Helpers
# --------------------------------------------------
def safe_display_table(series_or_df):
    """
    Makes Streamlit tables Arrow-compatible by converting mixed object columns
    to strings while preserving missing values as '-'.
    """
    if isinstance(series_or_df, pd.Series):
        out = series_or_df.to_frame("value")
    else:
        out = series_or_df.copy()

    for col in out.columns:
        if out[col].dtype == "object":
            out[col] = out[col].where(out[col].notna(), "-").astype(str)

    return out


def safe_dataframe(df):
    """
    Prevents Arrow serialization warnings in st.dataframe when a column contains
    mixed bool/string/object values.
    """
    out = df.copy()

    for col in out.columns:
        if out[col].dtype == "object":
            out[col] = out[col].where(out[col].notna(), "-").astype(str)

    return out

def stable_rng_from_key(key: str):
    """
    Deterministic RNG seed from a string key.
    """
    digest = hashlib.md5(key.encode()).hexdigest()
    return int(digest[:8], 16)


def generate_background_starfield(catalogue: str, n_stars: int = 220):
    """
    Create a deterministic decorative star field for the selected catalogue.
    These are NOT real sky coordinates, just visual background elements.
    """
    rng = np.random.default_rng(stable_rng_from_key(f"bg::{catalogue}"))

    x = rng.uniform(0.0, 1.0, n_stars)
    y = rng.uniform(0.0, 1.0, n_stars)

    # Small decorative stars
    base_sizes = rng.uniform(2, 8, n_stars)

    # Colour palette: cool white, blue-white, warm white, soft gold
    palette = np.array([
        "rgba(255,255,255,0.85)",
        "rgba(190,220,255,0.80)",
        "rgba(255,244,214,0.82)",
        "rgba(255,220,150,0.75)",
        "rgba(170,200,255,0.75)",
    ])
    colours = rng.choice(palette, size=n_stars)

    # Some stars get larger soft glows
    glow_mask = rng.random(n_stars) < 0.28
    glow_x = x[glow_mask]
    glow_y = y[glow_mask]
    glow_sizes = base_sizes[glow_mask] * rng.uniform(3.5, 6.5, glow_mask.sum())

    glow_palette = np.array([
        "rgba(255,255,255,0.08)",
        "rgba(180,210,255,0.10)",
        "rgba(255,225,170,0.10)",
        "rgba(210,190,255,0.08)",
    ])
    glow_colours = rng.choice(glow_palette, size=glow_mask.sum())

    # A few brighter “feature stars”
    bright_mask = rng.random(n_stars) < 0.08
    bright_x = x[bright_mask]
    bright_y = y[bright_mask]
    bright_sizes = base_sizes[bright_mask] * rng.uniform(1.8, 2.8, bright_mask.sum())
    bright_colours = rng.choice(
        np.array([
            "rgba(255,255,255,0.95)",
            "rgba(210,230,255,0.95)",
            "rgba(255,235,180,0.93)",
        ]),
        size=bright_mask.sum()
    )

    return {
        "x": x,
        "y": y,
        "sizes": base_sizes,
        "colours": colours,
        "glow_x": glow_x,
        "glow_y": glow_y,
        "glow_sizes": glow_sizes,
        "glow_colours": glow_colours,
        "bright_x": bright_x,
        "bright_y": bright_y,
        "bright_sizes": bright_sizes,
        "bright_colours": bright_colours,
    }
    
def nearest_cluster_from_click(click_point, candidate_df):
    """
    Resolve a Plotly click to the nearest visible real cluster using x/y position.
    This is more robust than relying on curveNumber/customdata because decorative
    glow/background traces can intercept clicks.
    """
    if not click_point:
        return None

    clicked_x = click_point.get("x")
    clicked_y = click_point.get("y")

    if clicked_x is None or clicked_y is None or len(candidate_df) == 0:
        return None

    temp = candidate_df.copy()
    temp["_click_dist2"] = (
        (temp["x"].astype(float) - float(clicked_x)) ** 2
        + (temp["y"].astype(float) - float(clicked_y)) ** 2
    )

    nearest = temp.sort_values("_click_dist2").iloc[0]

    # Optional guard: ignore clicks far away from any actual cluster.
    # With coordinates in [0, 1], this is a reasonable tolerance.
    if nearest["_click_dist2"] > 0.0025:
        return None

    return str(nearest["cluster_name"])

def stable_xy(catalogue: str, cluster_name: str):
    """
    Create deterministic pseudo-random coordinates in [0, 1] x [0, 1]
    so points look random but remain fixed between reruns.
    """
    key = f"{catalogue}::{cluster_name}"
    digest = hashlib.md5(key.encode()).hexdigest()

    x_seed = int(digest[:8], 16)
    y_seed = int(digest[8:16], 16)

    x = (x_seed % 10000) / 10000.0
    y = (y_seed % 10000) / 10000.0
    return x, y

def prepare_catalogue_frame(input_df, selected_catalogue, threshold):
    cat_df = input_df[input_df["catalogue"] == selected_catalogue].copy()
    cat_df["predicted_BHS"] = cat_df["p_BHS"] >= threshold

    coords = cat_df.apply(
        lambda row: stable_xy(row["catalogue"], str(row["cluster_name"])),
        axis=1
    )
    cat_df["x"] = [c[0] for c in coords]
    cat_df["y"] = [c[1] for c in coords]

    # marker size based on probability
    cat_df["marker_size"] = 10 + (cat_df["p_BHS"].clip(0, 1) * 25)

    return cat_df

def render_cluster_details(row, threshold, show_additional_metadata=True):
    st.subheader(f"Cluster Detail: {row['cluster_name']}")

    col1, col2, col3 = st.columns(3)
    col1.metric("Catalogue", row["catalogue"])
    col2.metric("p(BHS)", f"{row['p_BHS']:.3f}")
    col3.metric(
        "Prediction",
        "BHS candidate" if row["predicted_BHS"] else "Not BHS"
    )

    col4, col5, col6 = st.columns(3)
    col4.metric("Threshold", f"{threshold:.3f}")
    col5.metric("Threshold margin", f"{row['p_BHS'] - threshold:+.3f}")
    if "tier" in row.index and pd.notna(row["tier"]):
        col6.metric("Tier", str(row["tier"]))
    else:
        col6.metric("Tier", "-")

    feature_cols = [
        "CSB",
        "sigma0",
        "L_tot",
        "t_rh",
        "r_hl",
        "r_c",
        "rc_over_rhl",
        "L_over_rhl2",
    ]
    feature_cols = [c for c in feature_cols if c in row.index]

    if feature_cols:
        observable_height = 56 + (len(feature_cols) * 35)
        st.markdown("### Observable Information")
        st.dataframe(
    safe_display_table(row[feature_cols]),
    use_container_width=True,
    height=observable_height,
)

    extra_cols = [
        "paper_pred",
        "paper_pred_fallback",
        "lit_candidate",
        "catalogue_source",
        "relaxation_time_definition",
    ]
    extra_cols = [c for c in extra_cols if c in row.index]

    if show_additional_metadata and extra_cols:
        st.markdown("### Additional Metadata")
        st.dataframe(
    safe_display_table(row[extra_cols]),
    use_container_width=True,
    height=170,
)

# --------------------------------------------------
# Sidebar controls
# --------------------------------------------------
st.sidebar.header("Controls")

page = st.sidebar.radio(
    "Screen",
    ["Catalogue Explorer", "Star Map"]
)

catalogues = sorted(
    df["catalogue"].dropna().unique(),
    key=lambda value: str(value).casefold(),
)
selected_catalogue = st.sidebar.selectbox("Catalogue", catalogues)

threshold = st.sidebar.slider(
    "BHS probability threshold",
    min_value=0.00,
    max_value=1.00,
    value=0.495,
    step=0.005,
)

cat_df = prepare_catalogue_frame(df, selected_catalogue, threshold)

# --------------------------------------------------
# PAGE 1: Catalogue Explorer
# --------------------------------------------------
if page == "Catalogue Explorer":
    st.header("Catalogue Explorer")

    show_only_positive = st.checkbox("Show only positive candidates", value=False)

    display_df = cat_df.copy()
    if show_only_positive:
        display_df = display_df[display_df["predicted_BHS"]].copy()

    display_df = display_df.sort_values("p_BHS", ascending=False)

    n_total = len(cat_df)
    n_positive = int(cat_df["predicted_BHS"].sum())
    positive_rate = n_positive / n_total if n_total else 0

    col1, col2, col3 = st.columns(3)
    col1.metric("Clusters", n_total)
    col2.metric("Positive candidates", n_positive)
    col3.metric("Positive rate", f"{positive_rate:.1%}")

    st.subheader("Prediction distribution")

    fig = px.histogram(
        cat_df,
        x="p_BHS",
        nbins=30,
        color="predicted_BHS",
        labels={
            "p_BHS": "Predicted probability p(BHS)",
            "predicted_BHS": "Predicted BHS",
        },
        title=f"{selected_catalogue}: probability distribution",
    )

    fig.add_vline(
        x=threshold,
        line_dash="dash",
        annotation_text=f"threshold = {threshold:.3f}",
        annotation_position="top right",
    )

    st.plotly_chart(fig, use_container_width=True)

    st.subheader("Cluster predictions")

    preferred_cols = [
        "cluster_name",
        "p_BHS",
        "predicted_BHS",
        "paper_pred",
        "paper_pred_fallback",
        "lit_candidate",
        "tier",
        "CSB",
        "sigma0",
        "L_tot",
        "t_rh",
        "r_hl",
        "r_c",
        "rc_over_rhl",
        "L_over_rhl2",
    ]
    available_cols = [c for c in preferred_cols if c in display_df.columns]

    st.dataframe(
    safe_dataframe(display_df[available_cols]),
    use_container_width=True,
    hide_index=True,
)

    cluster_names = sorted(
        display_df["cluster_name"].dropna().astype(str).tolist(),
        key=str.casefold,
    )
    if cluster_names:
        selected_cluster = st.selectbox("Select cluster", cluster_names)
        row = display_df[display_df["cluster_name"].astype(str) == selected_cluster].iloc[0]
        render_cluster_details(row, threshold, show_additional_metadata=False)

# --------------------------------------------------
# PAGE 2: Star Map
# --------------------------------------------------
elif page == "Star Map":
    st.header("Star Map")
    st.caption(
        "Demo visualisation only: cluster positions are randomly assigned and do not represent real sky coordinates."
    )

    MAP_HEIGHT = 920

    def normalise_tier(value):
        if pd.isna(value):
            return "No tier"

        value = str(value).strip().lower()

        tier_map = {
            "r": "Robust",
            "robust": "Robust",
            "p": "Plausible",
            "plausible": "Plausible",
            "e": "Exploratory",
            "exploratory": "Exploratory",
        }

        return tier_map.get(value, "No tier")

    cat_df["tier_display"] = (
        cat_df["tier"].apply(normalise_tier)
        if "tier" in cat_df.columns
        else "No tier"
    )

    cat_df.loc[~cat_df["predicted_BHS"], "tier_display"] = "Not BHS"

    tier_colours = {
        "Robust": "rgba(255, 80, 80, 0.96)",
        "Plausible": "rgba(255, 190, 70, 0.96)",
        "Exploratory": "rgba(155, 120, 255, 0.96)",
        "No tier": "rgba(220, 220, 220, 0.86)",
        "Not BHS": "rgba(90, 150, 255, 0.68)",
    }

    tier_order = [
        "Robust",
        "Plausible",
        "Exploratory",
        "No tier",
        "Not BHS",
    ]

    st.markdown("### Search and select")

    search_query = st.text_input(
        "Search cluster name",
        value="",
        placeholder="e.g. NGC 3201, M 10, Pal 5"
    ).strip()

    filtered_df = cat_df.copy()

    if search_query:
        filtered_df = filtered_df[
            filtered_df["cluster_name"]
            .astype(str)
            .str.contains(search_query, case=False, na=False)
        ].copy()

    col_filter_1, col_filter_2, col_filter_3 = st.columns(3)

    with col_filter_1:
        show_tiers = st.multiselect(
            "Show tiers",
            options=tier_order,
            default=tier_order,
        )

    with col_filter_2:
        min_probability = st.slider(
            "Minimum p(BHS)",
            min_value=0.0,
            max_value=1.0,
            value=0.0,
            step=0.01,
        )

    with col_filter_3:
        label_high_prob = st.checkbox(
            "Label high-probability clusters",
            value=True,
        )

    filtered_df = filtered_df[
        filtered_df["tier_display"].isin(show_tiers)
        & (filtered_df["p_BHS"] >= min_probability)
    ].copy()

    if "selected_star_cluster" not in st.session_state:
        st.session_state.selected_star_cluster = None

    if len(filtered_df) == 0:
        st.warning("No clusters match the current search/filter settings.")
        st.stop()

    matching_names = filtered_df["cluster_name"].astype(str).tolist()

    if search_query and len(matching_names) == 1:
        st.session_state.selected_star_cluster = matching_names[0]

    if (
        st.session_state.selected_star_cluster is None
        or st.session_state.selected_star_cluster not in cat_df["cluster_name"].astype(str).values
    ):
        st.session_state.selected_star_cluster = (
            filtered_df.sort_values("p_BHS", ascending=False)
            .iloc[0]["cluster_name"]
        )

    dropdown_key = f"star_map_dropdown_{selected_catalogue}"
    dropdown_selected = st.session_state.get(dropdown_key)
    if dropdown_selected in matching_names:
        st.session_state.selected_star_cluster = dropdown_selected

    st.markdown("### Legend")
    legend_cols = st.columns(5)
    legend_items = [
        ("🔴", "Robust"),
        ("🟠", "Plausible"),
        ("🟣", "Exploratory"),
        ("⚪", "No tier"),
        ("🔵", "Not BHS"),
    ]

    for col, (icon, label) in zip(legend_cols, legend_items):
        with col:
            st.markdown(f"{icon} **{label}**")

    left, right = st.columns([3, 2])

    with left:
        fig_map = go.Figure()

        # -----------------------------------
        # Decorative background star field
        # -----------------------------------
        bg = generate_background_starfield(selected_catalogue, n_stars=260)

        # soft glow layer
        fig_map.add_trace(
            go.Scatter(
                x=bg["glow_x"],
                y=bg["glow_y"],
                mode="markers",
                marker=dict(
                    size=bg["glow_sizes"],
                    color=bg["glow_colours"],
                    line=dict(width=0),
                ),
                hoverinfo="skip",
                showlegend=False,
            )
        )

        # normal background stars
        fig_map.add_trace(
            go.Scatter(
                x=bg["x"],
                y=bg["y"],
                mode="markers",
                marker=dict(
                    size=bg["sizes"],
                    color=bg["colours"],
                    line=dict(width=0),
                ),
                hoverinfo="skip",
                showlegend=False,
            )
        )

        # brighter decorative stars
        fig_map.add_trace(
            go.Scatter(
                x=bg["bright_x"],
                y=bg["bright_y"],
                mode="markers",
                marker=dict(
                    size=bg["bright_sizes"],
                    color=bg["bright_colours"],
                    line=dict(width=0),
                ),
                hoverinfo="skip",
                showlegend=False,
            )
        )

        # -----------------------------------
        # Real demo cluster markers
        # -----------------------------------
        for tier_name in tier_order:
            tier_df = filtered_df[filtered_df["tier_display"] == tier_name].copy()

            if len(tier_df) == 0:
                continue

            text_labels = tier_df["cluster_name"].astype(str)

            if label_high_prob:
                text_labels = np.where(
                    tier_df["p_BHS"] >= 0.80,
                    tier_df["cluster_name"].astype(str),
                    ""
                )
            else:
                text_labels = [""] * len(tier_df)

            # subtle glow behind actual cluster markers
            fig_map.add_trace(
                go.Scatter(
                    x=tier_df["x"],
                    y=tier_df["y"],
                    mode="markers",
                    marker=dict(
                        size=tier_df["marker_size"] * 1.8,
                        color=tier_colours[tier_name].replace("0.96", "0.10").replace("0.86", "0.10").replace("0.68", "0.09"),
                        line=dict(width=0),
                    ),
                    hoverinfo="skip",
                    showlegend=False,
                )
            )

            fig_map.add_trace(
                go.Scatter(
                    x=tier_df["x"],
                    y=tier_df["y"],
                    mode="markers+text" if label_high_prob else "markers",
                    name=tier_name,
                    text=text_labels,
                    textposition="top center",
                    textfont=dict(
                        color="white",
                        size=11,
                    ),
                    customdata=np.stack(
                        [
                            tier_df["cluster_name"].astype(str),
                            tier_df["p_BHS"].astype(float),
                            tier_df["tier_display"].astype(str),
                            tier_df["predicted_BHS"].astype(str),
                        ],
                        axis=-1,
                    ),
                    marker=dict(
                        size=tier_df["marker_size"],
                        color=tier_colours[tier_name],
                        line=dict(width=1.5, color="white"),
                    ),
                    hovertemplate=(
                        "<b>%{customdata[0]}</b><br>"
                        "p(BHS): %{customdata[1]:.3f}<br>"
                        "Tier: %{customdata[2]}<br>"
                        "Predicted BHS: %{customdata[3]}<extra></extra>"
                    ),
                )
            )

        # highlight selected cluster
        selected_rows = cat_df[
            cat_df["cluster_name"].astype(str)
            == str(st.session_state.selected_star_cluster)
        ]

        if len(selected_rows) > 0:
            selected_row = selected_rows.iloc[0]

            # outer glow
            fig_map.add_trace(
                go.Scatter(
                    x=[selected_row["x"]],
                    y=[selected_row["y"]],
                    mode="markers",
                    marker=dict(
                        size=max(float(selected_row["marker_size"]) + 26, 44),
                        color="rgba(255,255,255,0.08)",
                        line=dict(width=0),
                    ),
                    hoverinfo="skip",
                    showlegend=False,
                )
            )

            # white selection ring
            fig_map.add_trace(
                go.Scatter(
                    x=[selected_row["x"]],
                    y=[selected_row["y"]],
                    mode="markers",
                    name="Selected",
                    marker=dict(
                        size=max(float(selected_row["marker_size"]) + 14, 32),
                        color="rgba(0,0,0,0)",
                        line=dict(width=4, color="white"),
                    ),
                    hoverinfo="skip",
                    showlegend=False,
                )
            )

        fig_map.update_layout(
            title=f"{selected_catalogue}: clickable cluster starmap",
            plot_bgcolor="rgb(4, 6, 16)",
            paper_bgcolor="rgb(4, 6, 16)",
            font=dict(color="white"),
            showlegend=False,
            autosize=True,
            height=MAP_HEIGHT,
            margin=dict(l=10, r=10, t=50, b=10),
            clickmode="event+select",
            xaxis=dict(
                showgrid=False,
                zeroline=False,
                visible=False,
                range=[0, 1],
            ),
            yaxis=dict(
                showgrid=False,
                zeroline=False,
                visible=False,
                range=[0, 1],
                scaleanchor="x",
                scaleratio=1,
            ),
        )

        clicked_points = plotly_events(
            fig_map,
            click_event=True,
            hover_event=False,
            select_event=False,
            override_height=MAP_HEIGHT,
            override_width="100%",
            key=f"star_map_{selected_catalogue}_{threshold}_{search_query}_{min_probability}_{len(filtered_df)}",
        )

        if clicked_points:
            clicked_cluster = nearest_cluster_from_click(
                clicked_points[0],
                filtered_df,
            )

            if clicked_cluster is not None:
                st.session_state.selected_star_cluster = clicked_cluster

    with right:
        info_panel = st.container(height=MAP_HEIGHT)
        with info_panel:
            st.markdown("### Selected cluster")

            cluster_options = sorted(
                filtered_df["cluster_name"].astype(str).tolist(),
                key=str.casefold,
            )

            current_selection = str(st.session_state.selected_star_cluster)

            if current_selection not in cluster_options:
                current_selection = cluster_options[0]
                st.session_state.selected_star_cluster = current_selection

            selected_index = cluster_options.index(current_selection)

            dropdown_selection = st.selectbox(
                "Choose cluster",
                cluster_options,
                index=selected_index,
                key=dropdown_key,
            )

            st.session_state.selected_star_cluster = dropdown_selection

            row = cat_df[
                cat_df["cluster_name"].astype(str)
                == str(st.session_state.selected_star_cluster)
            ].iloc[0]

            render_cluster_details(row, threshold, show_additional_metadata=False)
