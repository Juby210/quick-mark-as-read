const { Plugin } = require('powercord/entities')
const { Icon } = require('powercord/components')
const { findInReactTree } = require('powercord/util')
const { getModule, getModuleByDisplayName, constants: { ActionTypes },
    i18n: { Messages }, FluxDispatcher, React } = require('powercord/webpack')
const { inject, uninject } = require('powercord/injector')

module.exports = class QuickMarkAsRead extends Plugin {
    buttons = []

    async startPlugin() {
        const classes = await getModule(['iconItem'])
        const { ack, ackCategory } = await getModule(['ack', 'ackCategory'])
        const { hasCategoryUnread } = await getModule(['hasCategoryUnread'])
        const { getChannel } = await getModule(['getChannels'])
        const Tooltip = await getModuleByDisplayName('Tooltip')

        const ChannelItem = await getModuleByDisplayName('ChannelItem')
        inject('qmar', ChannelItem.prototype, 'renderIcons', function (_, res) {
            if (!res || !this.props.unread) return res
            const children = findInReactTree(res, c => Array.isArray(c))
            if (!children || children.find(c => c?.props?.__qmar)) return res

            children.unshift(React.createElement('div', { className: classes.iconItem, __qmar: true }, React.createElement(
                Tooltip,
                { text: Messages.MARK_AS_READ },
                props => React.createElement(Icon, {
                    ...props,
                    name: 'ChatCheck',
                    className: classes.actionIcon,
                    width: 18,
                    onClick: () => ack(this.props.channel.id)
                })
            )))

            return res
        })

        const _this = this
        class QMARCategoryButton extends React.PureComponent {
            constructor(props) {
                super(props)

                _this.buttons.push(this)
            }

            componentWillUnmount() {
                const i = _this.buttons.indexOf(this)
                if (i != -1) _this.buttons.splice(i, 1)
            }

            render() {
                if (hasCategoryUnread(this.props.channelId)) return React.createElement(
                    Tooltip,
                    { text: Messages.MARK_AS_READ },
                    props => React.createElement(Icon, {
                        ...props,
                        name: 'ChatCheck',
                        className: classes.actionIcon,
                        style: { zIndex: 1 },
                        width: 18,
                        onClick: () => ackCategory(this.props.channelId)
                    })
                )
                return null
            }
        }

        const ChannelCategoryItem = await getModuleByDisplayName('ChannelCategoryItem')
        inject('qmar-category', ChannelCategoryItem.prototype, 'renderIcons', function (_, res) {
            if (!res?.props) return res
            if (!Array.isArray(res.props.children)) res.props.children = [ res.props.children ]
            if (res.props.children.find(c => c?.type?.name == 'QMARCategoryButton')) return res

            res.props.children.unshift(React.createElement(QMARCategoryButton, { channelId: this.props.channel.id }))

            return res
        })

        FluxDispatcher.subscribe('MESSAGE_CREATE', this.onMessage = data => {
            const channel = getChannel(data.message.channel_id)
            if (channel) this.buttons.filter(b => b.props.channelId == channel.parent_id || b.props.channelId == channel.id).forEach(b => b.forceUpdate())
        })
        Object.values(ActionTypes).filter(t => t.includes('_ACK')).forEach(t => {
            FluxDispatcher.subscribe(t, this.onAck || (this.onAck = data => {
                if (!data.channelId) return
                const channel = getChannel(data.channelId)
                if (channel) this.buttons.filter(b => b.props.channelId == channel.parent_id || b.props.channelId == channel.id).forEach(b => b.forceUpdate())
            }))
        })
    }

    pluginWillUnload() {
        uninject('qmar')
        uninject('qmar-category')
        if (this.onMessage) FluxDispatcher.unsubscribe('MESSAGE_CREATE', this.onMessage)
        if (this.onAck) Object.values(ActionTypes).filter(t => t.includes('_ACK')).forEach(t => FluxDispatcher.unsubscribe(t, this.onAck))
    }
}
