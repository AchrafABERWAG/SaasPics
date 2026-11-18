'use client';

import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer';

// Register fonts (using standard fonts for now to avoid loading issues, 
// but in a real app we would load specific font files)
// Font.register({ family: 'Montserrat', src: '...' });

const styles = StyleSheet.create({
    page: {
        flexDirection: 'column',
        backgroundColor: '#FFFFFF',
        padding: 0, // We want full bleed if possible, or managed margins
    },
    // We design for A4, but imagine it folded in half (A5 chevalet)
    // Top half: Instructions upside down (so it stands up)
    // Bottom half: Main visual

    // Actually, let's do a simple 2-sided card on A4 landscape cut in half? 
    // Or A4 Portrait folded. Let's do A4 Portrait folded (Tent card).
    // Top half must be rotated 180 degrees.

    sectionTop: {
        height: '50%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomStyle: 'dashed',
        borderBottomWidth: 1,
        borderBottomColor: '#ccc',
        transform: 'rotate(180deg)', // Standard PDF viewers might not support container rotation easily, 
        // React-PDF supports 'transform' on View? 
        // Support is limited. Let's try standard layout first without fancy rotation if risky.
        // Actually, for a tent card, the top half IS upside down relative to the page.
        padding: 20,
    },
    sectionBottom: {
        height: '50%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        backgroundColor: '#F9F5F0', // Cream background for the main face
    },

    title: {
        fontSize: 24,
        marginBottom: 10,
        // fontFamily: 'Times-Roman', 
        color: '#D4AF37', // Gold
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 12,
        marginBottom: 20,
        color: '#555',
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    qrContainer: {
        width: 200,
        height: 200,
        marginBottom: 20,
        padding: 10,
        backgroundColor: 'white',
        borderRadius: 10,
    },
    qrImage: {
        width: '100%',
        height: '100%',
    },
    instruction: {
        fontSize: 14,
        color: '#333',
        textAlign: 'center',
        maxWidth: '80%',
        lineHeight: 1.5,
    },
    footer: {
        position: 'absolute',
        bottom: 20,
        fontSize: 10,
        color: '#999',
    }
});

interface TableCardProps {
    eventName: string;
    qrCodeUrl: string; // Data URL of the generated QR code
    slug: string;
}

export const TableCardDocument = ({ eventName, qrCodeUrl, slug }: TableCardProps) => (
    <Document>
        <Page size="A4" style={styles.page}>

            {/* Top Half (Back of the tent card) - Simple instructions */}
            <View style={[styles.sectionTop, { transform: 'rotate(180deg)' }]}>
                {/* Note: Rotation support in @react-pdf is per element or via transform logic. 
            If View transform rotates content, great. If not, we might need to rotate text/images individually.
            Testing standard view first. 
         */}
                {/* Workaround: If rotation fails, we just make a flat card design (cut in half). 
             Let's aim for a simple "Cut here" design (2 cards per A4) instead of folding if rotation is tricky.
             Actually 2 cards per A4 is safer and more efficient.
         */}
            </View>

        </Page>

        {/* Let's Try Plan B: 2 Cards per page (Landscape A4), side by side. 
        User cuts in middle. 
    */}
        <Page size="A4" orientation="landscape" style={{ flexDirection: 'row' }}>

            {/* Card 1 */}
            <View style={{ width: '50%', height: '100%', borderRightWidth: 1, borderRightColor: '#ccc', borderRightStyle: 'dashed', ...commonStyles.card }}>
                <View style={commonStyles.borderFrame}>
                    <Text style={styles.title}>{eventName}</Text>
                    <Text style={styles.subtitle}>Scannez pour partager</Text>

                    <View style={styles.qrContainer}>
                        <Image src={qrCodeUrl} style={styles.qrImage} />
                    </View>

                    <Text style={styles.instruction}>
                        Partagez vos photos en direct sur le grand écran !
                    </Text>
                    <Text style={{ fontSize: 10, marginTop: 10, color: '#8A9A83' }}>
                        lumina.events/event/{slug}
                    </Text>
                </View>
            </View>

            {/* Card 2 */}
            <View style={{ width: '50%', height: '100%', ...commonStyles.card }}>
                <View style={commonStyles.borderFrame}>
                    <Text style={styles.title}>{eventName}</Text>
                    <Text style={styles.subtitle}>Scannez pour partager</Text>

                    <View style={styles.qrContainer}>
                        <Image src={qrCodeUrl} style={styles.qrImage} />
                    </View>

                    <Text style={styles.instruction}>
                        Partagez vos photos en direct sur le grand écran !
                    </Text>
                    <Text style={{ fontSize: 10, marginTop: 10, color: '#8A9A83' }}>
                        lumina.events/event/{slug}
                    </Text>
                </View>
            </View>

        </Page>
    </Document>
);

const commonStyles = StyleSheet.create({
    card: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        backgroundColor: '#F9F5F0',
    },
    borderFrame: {
        width: '100%',
        height: '100%',
        borderWidth: 2,
        borderColor: '#D4AF37', // Gold
        borderRadius: 20,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    }
});
