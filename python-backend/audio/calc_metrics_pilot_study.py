import pandas as pd
import numpy as np
import os
import matplotlib.pyplot as plt
from collections import defaultdict
import re


def is_overlap(detected_start, detected_end, actual_start, actual_end, threshold=0.5):
    if pd.isna(detected_start) or pd.isna(detected_end):
        return False

    detected_start = float(detected_start)
    detected_end = float(detected_end)
    actual_start = float(actual_start)
    actual_end = float(actual_end)

    intersection_start = max(detected_start, actual_start)
    intersection_end = min(detected_end, actual_end)

    if intersection_end <= intersection_start:
        return False

    intersection_duration = intersection_end - intersection_start
    actual_duration = actual_end - actual_start

    overlap_ratio = intersection_duration / actual_duration

    return overlap_ratio >= threshold


def get_audio_condition(filename):
    if '_noise' in filename or '-noise' in filename:
        return 'noise'
    elif '_echo' in filename:
        return 'echo'
    elif '_slow' in filename:
        return 'slow'
    elif '_fast' in filename:
        return 'fast'
    else:
        return 'original'


def get_speech_category(filename):
    if any(accent in filename.lower() for accent in ['afrikaans', 'french', 'german']):
        return 'accent'
    elif any(emotion in filename.lower() for emotion in ['anxious', 'assertive', 'encouraging', 'happy', 'sad']):
        return 'emotion'
    else:
        return 'standard'


def get_phrase_position(row):
    start_time = float(row['actual_start'])

    if start_time < 3.0:
        return 'beginning'
    elif start_time < 7.0:
        return 'middle'
    else:
        return 'end'


def calculate_metrics(detections_csv, output_file=None, threshold=0.5):
    print(f"Loading detection results from {detections_csv}")
    df = pd.read_csv(detections_csv)

    if 'ground_truth_start' in df.columns and 'ground_truth_end' in df.columns:
        df = df.rename(columns={
            'ground_truth_start': 'actual_start',
            'ground_truth_end': 'actual_end'
        })

    df['condition'] = df['audio_file'].apply(get_audio_condition)
    df['speech_category'] = df['audio_file'].apply(get_speech_category)
    df['phrase_position'] = df.apply(get_phrase_position, axis=1)

    df['true_positive'] = df.apply(
        lambda row: is_overlap(
            row['detected_start'],
            row['detected_end'],
            row['actual_start'],
            row['actual_end'],
            threshold
        ),
        axis=1
    )

    df['false_positive'] = False
    detection_mask = ~pd.isna(df['detected_start']) & ~pd.isna(df['detected_end'])
    df.loc[detection_mask & ~df['true_positive'], 'false_positive'] = True

    df['detection_made'] = ~pd.isna(df['detected_start']) & ~pd.isna(df['detected_end'])

    results = []

    for model, model_df in df.groupby('model'):
        total_phrases = len(model_df)
        true_positives = model_df['true_positive'].sum()
        false_positives = model_df['false_positive'].sum()
        detections_made = model_df['detection_made'].sum()

        tpr = true_positives / total_phrases if total_phrases > 0 else 0
        fpr = false_positives / total_phrases if total_phrases > 0 else 0
        detection_rate = detections_made / total_phrases if total_phrases > 0 else 0

        results.append({
            'model': model,
            'category': 'all',
            'subcategory': 'all',
            'total_phrases': total_phrases,
            'true_positives': true_positives,
            'false_positives': false_positives,
            'detections_made': detections_made,
            'tpr': tpr,
            'fpr': fpr,
            'detection_rate': detection_rate
        })

        for condition, condition_df in model_df.groupby('condition'):
            condition_phrases = len(condition_df)
            condition_tp = condition_df['true_positive'].sum()
            condition_fp = condition_df['false_positive'].sum()
            condition_detections = condition_df['detection_made'].sum()

            condition_tpr = condition_tp / condition_phrases if condition_phrases > 0 else 0
            condition_fpr = condition_fp / condition_phrases if condition_phrases > 0 else 0
            condition_detection_rate = condition_detections / condition_phrases if condition_phrases > 0 else 0

            results.append({
                'model': model,
                'category': 'condition',
                'subcategory': condition,
                'total_phrases': condition_phrases,
                'true_positives': condition_tp,
                'false_positives': condition_fp,
                'detections_made': condition_detections,
                'tpr': condition_tpr,
                'fpr': condition_fpr,
                'detection_rate': condition_detection_rate
            })

        for category, category_df in model_df.groupby('speech_category'):
            category_phrases = len(category_df)
            category_tp = category_df['true_positive'].sum()
            category_fp = category_df['false_positive'].sum()
            category_detections = category_df['detection_made'].sum()

            category_tpr = category_tp / category_phrases if category_phrases > 0 else 0
            category_fpr = category_fp / category_phrases if category_phrases > 0 else 0
            category_detection_rate = category_detections / category_phrases if category_phrases > 0 else 0

            results.append({
                'model': model,
                'category': 'speech_category',
                'subcategory': category,
                'total_phrases': category_phrases,
                'true_positives': category_tp,
                'false_positives': category_fp,
                'detections_made': category_detections,
                'tpr': category_tpr,
                'fpr': category_fpr,
                'detection_rate': category_detection_rate
            })

        for phrase, phrase_df in model_df.groupby('phrase'):
            phrase_phrases = len(phrase_df)
            phrase_tp = phrase_df['true_positive'].sum()
            phrase_fp = phrase_df['false_positive'].sum()
            phrase_detections = phrase_df['detection_made'].sum()

            phrase_tpr = phrase_tp / phrase_phrases if phrase_phrases > 0 else 0
            phrase_fpr = phrase_fp / phrase_phrases if phrase_phrases > 0 else 0
            phrase_detection_rate = phrase_detections / phrase_phrases if phrase_phrases > 0 else 0

            results.append({
                'model': model,
                'category': 'phrase',
                'subcategory': phrase,
                'total_phrases': phrase_phrases,
                'true_positives': phrase_tp,
                'false_positives': phrase_fp,
                'detections_made': phrase_detections,
                'tpr': phrase_tpr,
                'fpr': phrase_fpr,
                'detection_rate': phrase_detection_rate
            })

        for position, position_df in model_df.groupby('phrase_position'):
            position_phrases = len(position_df)
            position_tp = position_df['true_positive'].sum()
            position_fp = position_df['false_positive'].sum()
            position_detections = position_df['detection_made'].sum()

            position_tpr = position_tp / position_phrases if position_phrases > 0 else 0
            position_fpr = position_fp / position_phrases if position_phrases > 0 else 0
            position_detection_rate = position_detections / position_phrases if position_phrases > 0 else 0

            results.append({
                'model': model,
                'category': 'phrase_position',
                'subcategory': position,
                'total_phrases': position_phrases,
                'true_positives': position_tp,
                'false_positives': position_fp,
                'detections_made': position_detections,
                'tpr': position_tpr,
                'fpr': position_fpr,
                'detection_rate': position_detection_rate
            })

    results_df = pd.DataFrame(results)

    print("\n=== OVERALL METRICS ===")
    for model, model_results in results_df[results_df['category'] == 'all'].groupby('model'):
        row = model_results.iloc[0]
        print(f"\n--- {model.upper()} MODEL ---")
        print(f"Total phrases: {row['total_phrases']}")
        print(f"True Positives: {row['true_positives']}")
        print(f"False Positives: {row['false_positives']}")
        print(f"TPR (True Positive Rate): {row['tpr']:.4f}")
        print(f"FPR (False Positive Rate): {row['fpr']:.4f}")

    print("\n=== METRICS BY CONDITION ===")
    for model, model_results in results_df[results_df['category'] == 'condition'].groupby('model'):
        print(f"\n--- {model.upper()} MODEL ---")
        for _, row in model_results.iterrows():
            print(f"  {row['subcategory']}: TPR={row['tpr']:.4f}, FPR={row['fpr']:.4f}, "
                  f"Phrases={row['total_phrases']}")

    print("\n=== METRICS BY SPEECH CATEGORY (EMOTION/ACCENT) ===")
    for model, model_results in results_df[results_df['category'] == 'speech_category'].groupby('model'):
        print(f"\n--- {model.upper()} MODEL ---")
        for _, row in model_results.iterrows():
            print(f"  {row['subcategory']}: TPR={row['tpr']:.4f}, FPR={row['fpr']:.4f}, "
                  f"Phrases={row['total_phrases']}")

    print("\n=== METRICS BY PHRASE ===")
    for model, model_results in results_df[results_df['category'] == 'phrase'].groupby('model'):
        print(f"\n--- {model.upper()} MODEL ---")
        for _, row in model_results.iterrows():
            print(f"  '{row['subcategory']}': TPR={row['tpr']:.4f}, FPR={row['fpr']:.4f}, "
                  f"Phrases={row['total_phrases']}")

    print("\n=== METRICS BY PHRASE POSITION ===")
    for model, model_results in results_df[results_df['category'] == 'phrase_position'].groupby('model'):
        print(f"\n--- {model.upper()} MODEL ---")
        for _, row in model_results.iterrows():
            print(f"  {row['subcategory']}: TPR={row['tpr']:.4f}, FPR={row['fpr']:.4f}, "
                  f"Phrases={row['total_phrases']}")

    if output_file:
        results_df.to_csv(output_file, index=False)
        print(f"\nSaved metrics to {output_file}")

    return results_df, df


def plot_metrics(results_df, output_dir=None):
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)

    plot_category_comparison(results_df, 'condition', 'TPR by Audio Condition', 'tpr', output_dir)
    plot_category_comparison(results_df, 'condition', 'FPR by Audio Condition', 'fpr', output_dir)
    plot_category_comparison(results_df, 'speech_category', 'TPR by Speech Category', 'tpr', output_dir)
    plot_category_comparison(results_df, 'speech_category', 'FPR by Speech Category', 'fpr', output_dir)
    plot_category_comparison(results_df, 'phrase', 'TPR by Phrase', 'tpr', output_dir)
    plot_category_comparison(results_df, 'phrase_position', 'TPR by Phrase Position', 'tpr', output_dir)

    plot_category_comparison(results_df, 'condition', 'Detection Rate by Audio Condition', 'detection_rate', output_dir)
    plot_category_comparison(results_df, 'speech_category', 'Detection Rate by Speech Category', 'detection_rate',
                             output_dir)
    plot_category_comparison(results_df, 'phrase', 'Detection Rate by Phrase', 'detection_rate', output_dir)
    plot_category_comparison(results_df, 'phrase_position', 'Detection Rate by Phrase Position', 'detection_rate',
                             output_dir)

    plot_overall_detection_rates(results_df, output_dir)


def plot_overall_detection_rates(results_df, output_dir=None):
    """Plot overall detection rates, TPR, and FPR for each model"""
    overall_df = results_df[results_df['category'] == 'all']

    if overall_df.empty:
        print("No overall data available")
        return

    plt.figure(figsize=(10, 6))

    models = overall_df['model'].unique()
    metrics = ['detection_rate', 'tpr', 'fpr']
    metric_labels = ['Detection Rate', 'TPR', 'FPR']

    bar_width = 0.25
    index = np.arange(len(metrics))

    for i, model in enumerate(models):
        model_data = overall_df[overall_df['model'] == model]
        if not model_data.empty:
            values = [
                model_data.iloc[0]['detection_rate'],
                model_data.iloc[0]['tpr'],
                model_data.iloc[0]['fpr']
            ]
            plt.bar(index + i * bar_width, values, bar_width, label=f'{model} model')

    plt.xlabel('Metric')
    plt.ylabel('Rate')
    plt.title('Overall Detection Metrics by Model')
    plt.xticks(index + bar_width / 2, metric_labels)
    plt.legend()
    plt.ylim(0, 1)

    if output_dir:
        filename = "overall_detection_metrics.png"
        plt.savefig(os.path.join(output_dir, filename), dpi=300, bbox_inches='tight')
    else:
        plt.show()


def plot_category_comparison(results_df, category, title, metric, output_dir=None):
    plot_df = results_df[results_df['category'] == category]

    if plot_df.empty:
        print(f"No data for category: {category}")
        return

    plt.figure(figsize=(12, 6))

    models = plot_df['model'].unique()
    subcategories = plot_df['subcategory'].unique()

    bar_width = 0.35
    index = np.arange(len(subcategories))

    for i, model in enumerate(models):
        model_data = plot_df[plot_df['model'] == model]
        metric_values = []

        for subcat in subcategories:
            subcat_row = model_data[model_data['subcategory'] == subcat]
            if not subcat_row.empty:
                metric_values.append(subcat_row.iloc[0][metric])
            else:
                metric_values.append(0)

        bars = plt.bar(index + i * bar_width, metric_values, bar_width, label=f'{model} model')

        for j, bar in enumerate(bars):
            height = bar.get_height()
            if height == 0:
                plt.bar(index[j] + i * bar_width, 0.005, bar_width, color=bar.get_facecolor(), alpha=0.3)
                label_height = 0.01
            else:
                label_height = height

            plt.text(bar.get_x() + bar.get_width() / 2., label_height + 0.01,
                     f'{metric_values[j]:.3f}', ha='center', va='bottom',
                     fontsize=9, rotation=0)

    plt.xlabel(category.replace('_', ' ').title())
    plt.ylabel(metric.replace('_', ' ').title())
    plt.title(f'{title} and Model')
    plt.xticks(index + bar_width / 2, subcategories)
    plt.legend()
    plt.ylim(0, 1)

    if output_dir:
        filename = f"{metric}_by_{category}.png"
        plt.savefig(os.path.join(output_dir, filename), dpi=300, bbox_inches='tight')
    else:
        plt.show()


def analyze_phrase_detection(detections_csv, output_dir=None, threshold=0.5):
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)

    output_file = os.path.join(output_dir, 'metrics.csv') if output_dir else None
    results_df, raw_df = calculate_metrics(detections_csv, output_file, threshold)

    plot_metrics(results_df, output_dir)

    print("\n=== MODEL COMPARISON ===")

    model_metrics = results_df[results_df['category'] == 'all']

    if len(model_metrics) >= 2:
        models = model_metrics['model'].tolist()
        tpr_values = model_metrics['tpr'].tolist()
        fpr_values = model_metrics['fpr'].tolist()
        detection_rates = model_metrics['detection_rate'].tolist()

        tpr_diff = abs(tpr_values[0] - tpr_values[1])
        fpr_diff = abs(fpr_values[0] - fpr_values[1])
        detection_diff = abs(detection_rates[0] - detection_rates[1])

        better_tpr_model = models[0] if tpr_values[0] > tpr_values[1] else models[1]
        better_fpr_model = models[0] if fpr_values[0] < fpr_values[1] else models[1]
        better_detection_model = models[0] if detection_rates[0] > detection_rates[1] else models[1]

        print(f"TPR Comparison: {better_tpr_model} model is better by {tpr_diff:.4f}")
        print(f"FPR Comparison: {better_fpr_model} model is better by {fpr_diff:.4f}")

    print("\n=== CONDITION IMPACT ANALYSIS ===")

    for model in results_df['model'].unique():
        model_data = results_df[(results_df['model'] == model) & (results_df['category'] == 'condition')]
        original_row = model_data[model_data['subcategory'] == 'original']

        if not original_row.empty:
            original_tpr = original_row.iloc[0]['tpr']

            print(f"\n{model.upper()} MODEL:")
            print(f"Original TPR: {original_tpr:.4f}")

            for condition in ['noise', 'echo', 'slow', 'fast']:
                condition_row = model_data[model_data['subcategory'] == condition]
                if not condition_row.empty:
                    condition_tpr = condition_row.iloc[0]['tpr']
                    tpr_change = condition_tpr - original_tpr
                    tpr_change_pct = (tpr_change / original_tpr) * 100 if original_tpr > 0 else float('inf')

                    impact = "improved" if tpr_change > 0 else "reduced"
                    print(
                        f"{condition.capitalize()} {impact} TPR by {abs(tpr_change):.4f} ({abs(tpr_change_pct):.1f}%)")

    print("\n=== SPEECH CATEGORY IMPACT ANALYSIS ===")

    for model in results_df['model'].unique():
        model_data = results_df[(results_df['model'] == model) & (results_df['category'] == 'speech_category')]
        standard_row = model_data[model_data['subcategory'] == 'standard']

        if not standard_row.empty:
            standard_tpr = standard_row.iloc[0]['tpr']

            print(f"\n{model.upper()} MODEL:")
            print(f"Standard speech TPR: {standard_tpr:.4f}")

            for category in ['emotion', 'accent']:
                category_row = model_data[model_data['subcategory'] == category]
                if not category_row.empty:
                    category_tpr = category_row.iloc[0]['tpr']
                    tpr_change = category_tpr - standard_tpr
                    tpr_change_pct = (tpr_change / standard_tpr) * 100 if standard_tpr > 0 else float('inf')

                    impact = "improved" if tpr_change > 0 else "reduced"
                    print(f"{category.capitalize()} {impact} TPR by {abs(tpr_change):.4f} ({abs(tpr_change_pct):.1f}%)")

    print("\n=== PHRASE-SPECIFIC PERFORMANCE ===")

    for model in results_df['model'].unique():
        model_data = results_df[(results_df['model'] == model) & (results_df['category'] == 'phrase')]

        if not model_data.empty:
            print(f"\n{model.upper()} MODEL:")

            sorted_phrases = model_data.sort_values('tpr', ascending=False)

            print("Best performing phrases:")
            for _, row in sorted_phrases.head(3).iterrows():
                print(f"  '{row['subcategory']}': TPR={row['tpr']:.4f}")

            print("Worst performing phrases:")
            for _, row in sorted_phrases.tail(3).iterrows():
                print(f"  '{row['subcategory']}': TPR={row['tpr']:.4f}")

    print("\n=== PHRASE POSITION IMPACT ANALYSIS ===")

    for model in results_df['model'].unique():
        model_data = results_df[(results_df['model'] == model) & (results_df['category'] == 'phrase_position')]

        if not model_data.empty:
            print(f"\n{model.upper()} MODEL:")

            for _, row in model_data.iterrows():
                print(f"  {row['subcategory']}: TPR={row['tpr']:.4f}")

    if output_dir:
        raw_output_file = os.path.join(output_dir, 'processed_detections.csv')
        raw_df.to_csv(raw_output_file, index=False)
        print(f"\nSaved processed detection data to {raw_output_file}")

    return results_df


if __name__ == "__main__":
    detections_csv = "D:/SoundFilter/pilot_study/whisper_detections.csv"
    output_dir = "D:/SoundFilter/pilot_study/results"
    threshold = 0.15

    analyze_phrase_detection(detections_csv, output_dir, threshold)