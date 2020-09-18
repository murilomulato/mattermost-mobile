// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {forwardRef, useEffect, useRef, useState, useImperativeHandle} from 'react';
import {Platform, StyleSheet, Text, View, ViewStyle} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import RNFetchBlob, {FetchBlobResponse, RNFetchBlobConfig, StatefulPromise} from 'rn-fetch-blob';
import Share from 'react-native-share';

import FormattedText from '@components/formatted_text';
import ProgressBar from '@components/progress_bar';
import {paddingHorizontal} from '@components/safe_area_view/iphone_x_spacing';
import {Client4} from '@mm-redux/client';
import {getLocalPath} from '@utils/file';
import mattermostBucket from 'app/mattermost_bucket';

import type {FileInfo} from '@mm-redux/types/files';
import {Theme} from '@mm-redux/types/preferences';
import type {DownloadRef} from 'types/screens/gallery';

type DownloadFileProps = {
    isLandscape: boolean;
    theme: Theme,
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#000000',
        flexDirection: 'row',
        height: Platform.select({ios: 99, android: 85}),
        paddingHorizontal: 12,
        paddingTop: 20,
    },
    containerLandscape: {
        height: 64,
    },
    saving: {
        color: '#FFFFFF',
        fontFamily: 'Open Sans',
        fontSize: 16,
        fontWeight: '600',
        lineHeight: 20,
    },
});

const DownloadFile = forwardRef<DownloadRef, DownloadFileProps>(({isLandscape, theme}: DownloadFileProps, ref) => {
    const containerStyles: Array<ViewStyle> = [styles.container];
    let downloadTask = useRef<StatefulPromise<FetchBlobResponse>>().current;
    const [progress, setProgress] = useState(0);
    const start = async (file: FileInfo): Promise<void> => {
        const localPath = getLocalPath(file);
        let uri;
        let certificate;

        if (file.id.startsWith('uid') && file.uri) {
            uri = file.uri;
        } else {
            uri = Client4.getFileUrl(file.id, Date.now());
            certificate = await mattermostBucket.getPreference('cert');
        }

        const options: RNFetchBlobConfig = {
            session: file.id,
            appendExt: file.extension,
            timeout: 10000,
            indicator: true,
            overwrite: true,
            path: localPath,
            certificate,
        };

        let path;
        try {
            const prefix = Platform.OS === 'android' ? 'file:/' : '';
            const exist = await RNFetchBlob.fs.exists(`${prefix}${localPath}`);
            if (exist) {
                path = localPath;
            } else {
                downloadTask = RNFetchBlob.config(options).fetch('GET', uri);
                downloadTask.progress((received: number, total: number) => {
                    setProgress(parseFloat((received / total).toFixed(1)));
                });
                const response = await downloadTask;
                path = response.path();
            }

            await Share.open({
                url: `file://${path}`,
                showAppsToView: true,
            });
        } catch (e) {
            // should we show an error, maybe just throw?
        }
    };

    useEffect(() => {
        return () => {
            if (downloadTask) {
                downloadTask.cancel();
            }
        };
    }, []);

    useImperativeHandle(ref, () => ({
        start,
    }));

    if (isLandscape) {
        containerStyles.push(styles.containerLandscape);
    }

    let label = <Text style={styles.saving}>{`${progress * 100}%`}</Text>;
    if (progress >= 1) {
        label = (
            <Icon
                name='checkmark'
                size={24}
                color='white'
                style={{fontWeight: '600', top: -5}}
            />
        );
    }

    return (
        <View style={[containerStyles, paddingHorizontal(isLandscape)]}>
            <FormattedText
                id='mobile.download_file.save'
                defaultMessage='Saving'
                style={styles.saving}
            />
            <View style={{marginTop: 10, flex: 1, marginHorizontal: 7, alignItems: 'flex-start'}}>
                <ProgressBar
                    progress={progress}
                    color={theme.buttonBg}
                />
            </View>
            <View style={{alignItems: 'center'}}>
                {label}
            </View>
        </View>
    );
});

DownloadFile.displayName = 'DownloadFile';

export default DownloadFile;